'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { trackLead, trackWhatsapp } from '@/lib/gtag'

type Msg = { role: 'user' | 'assistant'; content: string }

const WELCOME =
  'Oi! Eu sou a Lia, assistente da Nagamboa Imóveis. 👋 Posso te ajudar a encontrar casas, apartamentos e terrenos em Garopaba e na Praia da Gamboa. O que você procura?'

// Converte /imovel/XXX e URLs em links clicáveis
function renderContent(text: string) {
  const parts = text.split(/((?:https?:\/\/[^\s)]+)|(?:\/imovel\/[A-Za-z0-9]+))/g)
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part) || /^\/imovel\//.test(part)) {
      return (
        <a key={i} href={part} target={part.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" style={{ color: '#E8B23A', textDecoration: 'underline' }}>
          {part.startsWith('/imovel/') ? `ver imóvel ${part.split('/').pop()}` : part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function ChatWidget() {
  // A Lia é do site público; dentro do painel interno (/painel) ela não aparece
  const pathname = usePathname()
  const noPainel = pathname?.startsWith('/painel') ?? false
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [teaser, setTeaser] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [corretor, setCorretor] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, loading, open])

  useEffect(() => {
    const abrir = () => {
      setTeaser(false)
      setOpen(true)
    }
    window.addEventListener('nagamboa:abrir-chat', abrir)
    return () => window.removeEventListener('nagamboa:abrir-chat', abrir)
  }, [])

  useEffect(() => {
    // Mostra o convite uma vez por sessão: evita o balão aparecer sobre o conteúdo
    // a cada página e engolir toques do usuário
    let visto = false
    try {
      visto = sessionStorage.getItem('lia-convite') === '1'
    } catch {}
    if (visto) return
    const t = setTimeout(() => {
      setTeaser(true)
      try {
        sessionStorage.setItem('lia-convite', '1')
      } catch {}
    }, 3500)
    return () => clearTimeout(t)
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const next: Msg[] = [...msgs, { role: 'user', content: text }]
    setMsgs(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok || !res.body) throw new Error('indisponível')

      // Resposta em NDJSON streaming: monta a mensagem da assistente ao vivo
      setMsgs((m) => [...m, { role: 'assistant', content: '' }])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let got = false
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let ev: { t: string; v?: string; whatsapp?: string | null; corretor?: string | null }
          try {
            ev = JSON.parse(line)
          } catch {
            continue
          }
          if (ev.t === 'busca') {
            setBuscando(true)
          } else if (ev.t === 'd' && ev.v) {
            got = true
            setBuscando(false)
            setMsgs((m) => {
              const copy = [...m]
              const last = copy[copy.length - 1]
              copy[copy.length - 1] = { ...last, content: last.content + ev.v }
              return copy
            })
          } else if (ev.t === 'end') {
            if (ev.whatsapp) {
              setWhatsapp(ev.whatsapp)
              trackLead('lia')
            }
            if (ev.corretor) setCorretor(ev.corretor)
          } else if (ev.t === 'err') {
            throw new Error('erro no servidor')
          }
        }
      }
      if (!got) throw new Error('resposta vazia')
    } catch {
      setMsgs((m) => {
        const copy = m[m.length - 1]?.role === 'assistant' && m[m.length - 1].content === '' ? m.slice(0, -1) : m
        return [
          ...copy,
          { role: 'assistant', content: 'Estou com dificuldade técnica agora. Você pode falar direto com a gente no WhatsApp pelo botão "Fale conosco" ali em cima. 🙏' },
        ]
      })
    } finally {
      setLoading(false)
      setBuscando(false)
    }
  }

  if (noPainel) return null

  return (
    <>
      <style>{`
        @keyframes liaPulse {
          0% { box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 0 0 rgba(232,178,58,.55); }
          70% { box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 0 14px rgba(232,178,58,0); }
          100% { box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 0 0 rgba(232,178,58,0); }
        }
        @keyframes liaAcena {
          0%, 76%, 100% { transform: rotate(0) scale(1); }
          80% { transform: rotate(-7deg) scale(1.07); }
          84% { transform: rotate(6deg) scale(1.07); }
          88% { transform: rotate(-5deg) scale(1.05); }
          92% { transform: rotate(3deg) scale(1.02); }
        }
        @keyframes liaConvite {
          0% { opacity: 0; transform: translateY(14px) scale(.92); }
          60% { opacity: 1; transform: translateY(-3px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes liaFlutua {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes liaGira { to { transform: rotate(360deg); } }
        .lia-btn { animation: liaPulse 2.6s ease-out infinite, liaAcena 5s ease-in-out infinite; }
        .lia-convite { animation: liaConvite .5s ease-out, liaFlutua 3s ease-in-out .5s infinite; }
      `}</style>

      {/* Convite da Lia */}
      {teaser && !open && (
        <div
          className="lia-convite lia-teaser"
          style={{
            position: 'fixed', right: 22, bottom: 112, zIndex: 299,
            maxWidth: 252, background: '#10204A', border: '1px solid rgba(232,178,58,.5)',
            borderRadius: '16px 16px 4px 16px', padding: '14px 16px',
            boxShadow: '0 10px 32px rgba(0,0,0,.5)', fontFamily: "'Jost',sans-serif",
          }}
        >
          <button
            onClick={() => setTeaser(false)}
            aria-label="Dispensar"
            style={{ position: 'absolute', top: 0, right: 0, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'rgba(255,255,255,.55)', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
          <div onClick={() => { setTeaser(false); setOpen(true) }} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: 13.5, color: '#fff', lineHeight: 1.45, paddingRight: 10 }}>
              Oi! Eu sou a <strong style={{ color: '#E8B23A' }}>Lia</strong> 👋 Quer ajuda pra encontrar seu imóvel em Garopaba?
            </div>
            <div style={{ fontSize: 12, color: '#E8B23A', fontWeight: 600, marginTop: 7 }}>Conversar agora →</div>
          </div>
        </div>
      )}

      {/* Balão flutuante */}
      <button
        onClick={() => {
          setTeaser(false)
          setOpen((o) => !o)
        }}
        aria-label={open ? 'Fechar chat' : 'Abrir chat'}
        className={'lia-fab' + (open ? '' : ' lia-btn')}
        style={{
          position: 'fixed', right: 22, bottom: 40, zIndex: 300,
          width: 58, height: 58, borderRadius: '50%', cursor: 'pointer',
          border: '2px solid #E8B23A', padding: 0, overflow: 'hidden',
          background: open ? '#E8B23A' : '#0A1430', color: '#0A1430', fontSize: 26, fontWeight: 700,
          boxShadow: '0 6px 24px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {open ? '×' : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/assets/lia.webp" alt="Lia, assistente virtual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </button>

      {open && (
        <div
          className="lia-panel"
          style={{
            position: 'fixed', right: 22, bottom: 110, zIndex: 300,
            width: 'min(380px, calc(100vw - 32px))', height: 'min(540px, calc(100dvh - 148px))',
            background: '#0B1738', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,.55)', fontFamily: "'Jost',sans-serif", color: '#fff',
          }}
        >
          <div style={{ padding: '14px 18px', background: '#10204A', borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/lia.webp" alt="Lia" style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid rgba(232,178,58,.7)' }} />
            <div>
              <div style={{ fontFamily: "'Marcellus',serif", fontSize: 17 }}>Lia · Nagamboa Imóveis</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Assistente virtual · Garopaba e Praia da Gamboa</div>
            </div>
          </div>

          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.filter((m) => m.content !== '').map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.5,
                  background: m.role === 'user' ? '#E8B23A' : '#16265C',
                  color: m.role === 'user' ? '#0A1430' : '#fff',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}
              >
                {renderContent(m.content)}
              </div>
            ))}
            {loading && !buscando && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 14, background: '#16265C', fontSize: 14, color: 'rgba(255,255,255,.7)' }}>
                digitando…
              </div>
            )}
            {buscando && (
              <div style={{ alignSelf: 'flex-start', padding: '11px 14px', borderRadius: 14, background: '#16265C', border: '1px solid rgba(232,178,58,.35)', fontSize: 13, color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(232,178,58,.35)', borderTopColor: '#E8B23A', animation: 'liaGira .9s linear infinite', flexShrink: 0 }} />
                <span>Buscando no nosso portfólio… essa busca leva em média 30 segundos 🙏</span>
              </div>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Acabei de falar com a assistente do site da Nagamboa.')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsapp('lia')}
                style={{
                  alignSelf: 'center', marginTop: 4, background: '#25D366', color: '#07301c',
                  borderRadius: 30, padding: '12px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Falar com {corretor ?? 'o corretor'} no WhatsApp →
              </a>
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder="Escreva sua mensagem…"
              style={{
                flex: 1, background: '#0A1430', border: '1px solid rgba(255,255,255,.15)', borderRadius: 11,
                padding: '11px 13px', fontSize: 14, color: '#fff', outline: 'none', fontFamily: "'Jost',sans-serif",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 11, padding: '0 18px',
                fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading || !input.trim() ? 0.6 : 1,
                fontFamily: "'Jost',sans-serif",
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
