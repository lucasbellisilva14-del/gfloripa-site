'use client'

import { useState } from 'react'

type Props = {
  codigo: string
  titulo: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0B1738',
  border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 11,
  padding: '13px 15px',
  fontSize: 14,
  color: '#fff',
  outline: 'none',
  fontFamily: "'Jost',sans-serif",
}

export default function InterestForm({ codigo, titulo }: Props) {
  const [open, setOpen] = useState<null | 'interesse' | 'visita'>(null)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    setError('')
    setSending(true)

    const params = new URLSearchParams(window.location.search)
    const assunto = open === 'visita' ? `Agendar visita ao imóvel ${codigo}` : `Interesse no imóvel ${codigo}`

    let whatsapp = '5548984727799'
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          telefone,
          email,
          mensagem,
          codigo,
          assunto,
          url: window.location.href,
          gclid: params.get('gclid') ?? '',
          utm_source: params.get('utm_source') ?? '',
          utm_medium: params.get('utm_medium') ?? '',
          utm_campaign: params.get('utm_campaign') ?? '',
        }),
      })
      if (res.status === 400) {
        const data = await res.json()
        setError(data.error ?? 'Verifique os dados e tente novamente')
        setSending(false)
        return
      }
      const data = await res.json().catch(() => null)
      if (data?.whatsapp) whatsapp = data.whatsapp
    } catch {
      // mesmo sem o CRM, segue para o WhatsApp
    }

    const texto =
      open === 'visita'
        ? `Olá! Sou ${nome} e gostaria de agendar uma visita ao imóvel ${codigo} — ${titulo}.`
        : `Olá! Sou ${nome} e tenho interesse no imóvel ${codigo} — ${titulo}.${mensagem ? ` ${mensagem}` : ''}`
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
    setSending(false)
    setOpen(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen('interesse')}
        style={{ display: 'block', width: '100%', textAlign: 'center', background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 12, padding: 15, fontSize: 14, fontWeight: 600, letterSpacing: '.03em', cursor: 'pointer', marginBottom: 10, fontFamily: "'Jost',sans-serif" }}
      >
        Tenho interesse
      </button>
      <button
        onClick={() => setOpen('visita')}
        style={{ display: 'block', width: '100%', textAlign: 'center', background: 'transparent', border: '1.5px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 12, padding: 15, fontSize: 14, cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}
      >
        Agendar uma visita
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(5,10,26,.78)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '28px 26px', width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
              <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 22 }}>
                {open === 'visita' ? 'Agendar uma visita' : 'Tenho interesse'}
              </h3>
              <button onClick={() => setOpen(null)} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 18 }}>
              Imóvel {codigo} · Você será atendido pelo WhatsApp do corretor responsável.
            </p>
            <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
              <input style={inputStyle} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              <input style={inputStyle} placeholder="WhatsApp (com DDD)" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
              <input style={inputStyle} placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} placeholder="Mensagem (opcional)" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
              {error && <div style={{ fontSize: 13, color: '#F0A0A0' }}>{error}</div>}
              <button
                type="submit"
                disabled={sending}
                style={{ background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 11, padding: 14, fontSize: 14, fontWeight: 600, cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1, fontFamily: "'Jost',sans-serif" }}
              >
                {sending ? 'Enviando…' : 'Continuar no WhatsApp'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
