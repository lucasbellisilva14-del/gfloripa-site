import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import type { StatusLembrete } from '@/lib/painel/tipos'

// Atualiza status (concluir, cancelar, reabrir) de um lembrete.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const { id } = await params
  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const status = body.status as StatusLembrete
  if (!['pendente', 'concluido', 'cancelado'].includes(status)) {
    return Response.json({ error: 'Status inválido' }, { status: 400 })
  }
  const db = await getDb()
  const existente = (await db.listarLembretes({ corretor_id: auth.corretor.id })).find((l) => l.id === id)
  if (!existente) return Response.json({ error: 'Lembrete não encontrado' }, { status: 404 })
  const lembrete = await db.atualizarLembrete(id, { status })
  return Response.json({ ok: true, lembrete })
}
