import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import type { TipoCliente } from '@/lib/painel/tipos'

const TIPOS: TipoCliente[] = ['comprador', 'locatario', 'proprietario', 'indefinido']

// Correção manual da ficha. Mudar o tipo aqui fixa o tipo: a análise passa a
// respeitá-lo e não sobrescreve mais.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const { id } = await params
  let body: { nome?: string; telefone?: string | null; email?: string | null; tipo?: string; liberar_tipo?: boolean }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const db = await getDb()
  const cliente = await db.obterCliente(id)
  if (!cliente || cliente.corretor_id !== auth.corretor.id) {
    return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  const patch: Parameters<typeof db.atualizarCliente>[1] = {}
  if (typeof body.nome === 'string' && body.nome.trim()) patch.nome = body.nome.trim().slice(0, 120)
  if (body.telefone !== undefined) patch.telefone = body.telefone?.trim() ? body.telefone.trim().slice(0, 40) : null
  if (body.email !== undefined) patch.email = body.email?.trim() ? body.email.trim().slice(0, 160) : null
  if (typeof body.tipo === 'string') {
    if (!(TIPOS as string[]).includes(body.tipo)) return Response.json({ error: 'Tipo inválido' }, { status: 400 })
    patch.tipo = body.tipo as TipoCliente
    patch.tipo_origem = body.tipo === 'indefinido' ? 'ia' : 'manual'
  }
  // "liberar": volta a deixar a I.A. decidir o tipo nas próximas análises
  if (body.liberar_tipo === true) patch.tipo_origem = 'ia'

  const atualizado = await db.atualizarCliente(id, patch)
  return Response.json({ ok: true, cliente: atualizado })
}
