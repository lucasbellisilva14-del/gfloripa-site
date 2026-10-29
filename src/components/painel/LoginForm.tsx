'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginForm({ demo, destino }: { demo: boolean; destino: string }) {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/painel/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(body.error ?? 'Não foi possível entrar')
        return
      }
      router.push(destino.startsWith('/painel') ? destino : '/painel')
      router.refresh()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={entrar} style={{ display: 'grid', gap: 14 }}>
      <div className="p-field">
        <label htmlFor="senha">Senha do painel</label>
        <input id="senha" className="p-input" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={demo ? 'demo' : '••••••••'} autoFocus />
      </div>
      {demo && <div className="p-alert p-alert-info">Modo demonstração: PAINEL_SENHA não está configurada. Entre com a senha <strong>demo</strong>.</div>}
      {erro && <div className="p-alert p-alert-danger">{erro}</div>}
      <button type="submit" className="p-btn p-btn-primary" disabled={enviando || !senha}>
        {enviando ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
