'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Cliente, TipoCliente } from '@/lib/painel/tipos'
import { ROTULO_TIPO_CLIENTE } from '@/lib/painel/tipos'

// Correção manual da ficha. O tipo escolhido aqui fica fixado: a I.A. não o
// sobrescreve nas próximas análises, a menos que você "liberar" de novo.
export default function ClienteEditar({ cliente }: { cliente: Cliente }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    setSalvando(true)
    try {
      const res = await fetch(`/api/painel/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome: fd.get('nome'),
          telefone: fd.get('telefone'),
          email: fd.get('email'),
          tipo: fd.get('tipo'),
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setErro(b.error ?? 'Não foi possível salvar')
        return
      }
      setAberto(false)
      router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  async function liberarTipo() {
    await fetch(`/api/painel/clientes/${cliente.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liberar_tipo: true }),
    })
    router.refresh()
  }

  if (!aberto) {
    return (
      <span className="p-row" style={{ gap: 6 }}>
        <button type="button" className="p-btn p-btn-sm" onClick={() => setAberto(true)}>Editar ficha</button>
        {cliente.tipo_origem === 'manual' && (
          <button type="button" className="p-btn p-btn-sm p-btn-ghost" title="Deixar a I.A. voltar a decidir o tipo" onClick={liberarTipo}>
            Tipo fixado por você · liberar
          </button>
        )}
      </span>
    )
  }

  const tipos: TipoCliente[] = ['comprador', 'locatario', 'proprietario', 'indefinido']
  return (
    <form onSubmit={enviar} className="p-card" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <div className="p-form-grid">
        <div className="p-field"><label htmlFor="ed-nome">Nome</label><input id="ed-nome" name="nome" className="p-input" defaultValue={cliente.nome} required /></div>
        <div className="p-field"><label htmlFor="ed-telefone">Telefone</label><input id="ed-telefone" name="telefone" className="p-input" defaultValue={cliente.telefone ?? ''} inputMode="tel" /></div>
        <div className="p-field"><label htmlFor="ed-email">E-mail</label><input id="ed-email" name="email" type="email" className="p-input" defaultValue={cliente.email ?? ''} /></div>
        <div className="p-field">
          <label htmlFor="ed-tipo">Tipo de cliente</label>
          <select id="ed-tipo" name="tipo" className="p-select" defaultValue={cliente.tipo}>
            {tipos.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_CLIENTE[t]}</option>
            ))}
          </select>
          <span className="p-small p-muted">O tipo que você escolher fica fixado: a I.A. não o altera nas próximas análises.</span>
        </div>
      </div>
      {erro && <div className="p-alert p-alert-danger">{erro}</div>}
      <div className="p-row">
        <button type="submit" className="p-btn p-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" className="p-btn" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  )
}
