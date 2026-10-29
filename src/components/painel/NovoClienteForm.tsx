'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NovoClienteForm() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/painel/clientes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setErro(b.error ?? 'Não foi possível salvar')
      return
    }
    const b = await res.json()
    router.push(`/painel/clientes/${b.cliente.id}`)
    router.refresh()
  }

  if (!aberto) return <button type="button" className="p-btn" onClick={() => setAberto(true)}>Novo cliente</button>

  return (
    <form onSubmit={enviar} className="p-card" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
      <div className="p-form-grid">
        <div className="p-field"><label htmlFor="nome">Nome</label><input id="nome" name="nome" className="p-input" required /></div>
        <div className="p-field"><label htmlFor="telefone">Telefone</label><input id="telefone" name="telefone" className="p-input" inputMode="tel" /></div>
        <div className="p-field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="p-input" /></div>
        <div className="p-field">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" className="p-select" defaultValue="comprador">
            <option value="comprador">Comprador</option>
            <option value="locatario">Locatário</option>
            <option value="proprietario">Proprietário</option>
            <option value="indefinido">Não informado</option>
          </select>
        </div>
      </div>
      {erro && <div className="p-alert p-alert-danger">{erro}</div>}
      <div className="p-row">
        <button type="submit" className="p-btn p-btn-primary">Salvar</button>
        <button type="button" className="p-btn" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  )
}
