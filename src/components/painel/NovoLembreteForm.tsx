'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Cliente } from '@/lib/painel/tipos'

export default function NovoLembreteForm({ clientes, clienteId }: { clientes: Pick<Cliente, 'id' | 'nome'>[]; clienteId?: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErro(null)
    setEnviando(true)
    const res = await fetch('/api/painel/lembretes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        titulo: fd.get('titulo'),
        data: fd.get('data'),
        cliente_id: fd.get('cliente_id') || null,
        origem: 'manual',
      }),
    })
    setEnviando(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setErro(b.error ?? 'Não foi possível criar')
      return
    }
    form.reset()
    router.refresh()
  }

  return (
    <form onSubmit={enviar} className="p-row" style={{ alignItems: 'flex-end', gap: 10 }}>
      <div className="p-field" style={{ flex: '2 1 220px' }}>
        <label htmlFor="titulo">Novo lembrete</label>
        <input id="titulo" name="titulo" className="p-input" placeholder="Ex.: Ligar para confirmar visita" required />
      </div>
      <div className="p-field" style={{ flex: '1 1 180px' }}>
        <label htmlFor="data">Quando</label>
        <input id="data" name="data" type="datetime-local" className="p-input" required />
      </div>
      {clienteId ? (
        <input type="hidden" name="cliente_id" value={clienteId} />
      ) : (
        <div className="p-field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="cliente_id">Cliente</label>
          <select id="cliente_id" name="cliente_id" className="p-select" defaultValue="">
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className="p-btn p-btn-navy" disabled={enviando}>Adicionar</button>
      {erro && <div className="p-alert p-alert-danger" style={{ flexBasis: '100%' }}>{erro}</div>}
    </form>
  )
}
