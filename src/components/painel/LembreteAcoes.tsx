'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { StatusLembrete } from '@/lib/painel/tipos'

export default function LembreteAcoes({ id, status }: { id: string; status: StatusLembrete }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  async function mudar(novo: StatusLembrete) {
    setOcupado(true)
    await fetch(`/api/painel/lembretes/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: novo }) })
    setOcupado(false)
    router.refresh()
  }
  if (status === 'pendente') {
    return (
      <span className="p-row" style={{ gap: 6 }}>
        <button type="button" className="p-btn p-btn-sm p-btn-primary" disabled={ocupado} onClick={() => mudar('concluido')}>Concluir</button>
        <button type="button" className="p-btn p-btn-sm" disabled={ocupado} onClick={() => mudar('cancelado')}>Cancelar</button>
      </span>
    )
  }
  return (
    <button type="button" className="p-btn p-btn-sm" disabled={ocupado} onClick={() => mudar('pendente')}>Reabrir</button>
  )
}
