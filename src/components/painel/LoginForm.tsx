'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Login por usuário e senha. Sem usuário, vale a senha mestra do gestor
// (compatível com o login antigo de senha única).
export default function LoginForm({ demo, destino }: { demo: boolean; destino: string }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
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
        body: JSON.stringify({ usuario, senha }),
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
        <label htmlFor="usuario">Usuário</label>
        <input id="usuario" className="p-input" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={usuario} onChange={(e) => setUsuario(e.target.value.toLowerCase())} placeholder="seu nome de usuário" autoFocus />
      </div>
      <div className="p-field">
        <label htmlFor="senha">Senha</label>
        <input id="senha" className="p-input" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={demo ? 'demo' : '••••••••'} />
      </div>
      {demo && <div className="p-alert p-alert-info">Modo demonstração: entre com qualquer usuário da equipe (lucas, murilo, edmilson, marcia, juliana) e a senha <strong>demo</strong>.</div>}
      {erro && <div className="p-alert p-alert-danger">{erro}</div>}
      <button type="submit" className="p-btn p-btn-primary" disabled={enviando || !senha}>
        {enviando ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
