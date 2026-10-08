'use client'

import { useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

const WELCOME =
  'Olá! 👋 Sou a assistente virtual da Nagamboa Imóveis. Posso te ajudar a encontrar casas, apartamentos e terrenos em Garopaba e na Praia da Gamboa. O que você procura?'

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
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [corretor, setCorretor] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, loading, open])

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
          if (ev.t === 'd' && ev.v) {
            got = true
            setMsgs((m) => {
              const copy = [...m]
              const last = copy[copy.length - 1]
              copy[copy.length - 1] = { ...last, content: last.content + ev.v }
              return copy
            })
          } else if (ev.t === 'end') {
            if (ev.whatsapp) setWhatsapp(ev.whatsapp)
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
    }
  }

  return (
    <>
      {/* Balão flutuante */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Fechar chat' : 'Abrir chat'}
        style={{
          position: 'fixed', right: 22, bottom: 22, zIndex: 300,
          width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#E8B23A', color: '#0A1430', fontSize: 26, fontWeight: 700,
          boxShadow: '0 6px 24px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {open ? '×' : '💬'}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', right: 22, bottom: 92, zIndex: 300,
            width: 'min(380px, calc(100vw - 32px))', height: 'min(540px, calc(100vh - 130px))',
            background: '#0B1738', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,.55)', fontFamily: "'Jost',sans-serif", color: '#fff',
          }}
        >
          <div style={{ padding: '16px 18px', background: '#10204A', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ fontFamily: "'Marcellus',serif", fontSize: 17 }}>Nagamboa Imóveis</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Assistente virtual · Garopaba e Praia da Gamboa</div>
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
            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 14, background: '#16265C', fontSize: 14, color: 'rgba(255,255,255,.7)' }}>
                digitando…
              </div>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Acabei de falar com a assistente do site da Nagamboa.')}`}
                target="_blank"
                rel="noopener noreferrer"
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
