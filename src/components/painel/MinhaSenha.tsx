'use client'

import { useState } from 'react'

// Troca da própria senha (qualquer corretor).
export default function MinhaSenha() {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (nova !== confirma) {
      setMsg({ tipo: 'erro', texto: 'A confirmação não bate com a nova senha.' })
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/painel/senha', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senha_atual: atual, nova_senha: nova }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ tipo: 'erro', texto: dados.error ?? 'Não foi possível trocar a senha' })
        return
      }
      setMsg({ tipo: 'ok', texto: 'Senha trocada. Use a nova no próximo login.' })
      setAtual('')
      setNova('')
      setConfirma('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="p-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
      <div className="p-field">
        <label htmlFor="senha-atual">Senha atual</label>
        <input id="senha-atual" className="p-input" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required />
      </div>
      <div className="p-field">
        <label htmlFor="senha-nova">Nova senha</label>
        <input id="senha-nova" className="p-input" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} minLength={6} required />
      </div>
      <div className="p-field">
        <label htmlFor="senha-confirma">Repetir nova senha</label>
        <input id="senha-confirma" className="p-input" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} minLength={6} required />
      </div>
      <button type="submit" className="p-btn" disabled={enviando || !atual || !nova}>{enviando ? 'Salvando...' : 'Trocar senha'}</button>
      {msg && <div className={`p-alert ${msg.tipo === 'ok' ? 'p-alert-info' : 'p-alert-danger'}`} style={{ flexBasis: '100%' }}>{msg.texto}</div>}
    </form>
  )
}
