import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import type { TipoCliente } from '@/lib/painel/tipos'

export async function GET() {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  return Response.json({ clientes: await db.listarClientes(auth.corretor.id) })
}

// Cadastro manual de cliente (sem análise).
export async function POST(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  let body: { nome?: string; telefone?: string; email?: string; tipo?: string; origem?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const nome = String(body.nome ?? '').trim()
  if (!nome) return Response.json({ error: 'Informe o nome' }, { status: 400 })
  const tipos: TipoCliente[] = ['comprador', 'locatario', 'proprietario', 'indefinido']
  const db = await getDb()
  const cliente = await db.criarCliente({
    corretor_id: auth.corretor.id,
    nome,
    telefone: body.telefone?.trim() || null,
    email: body.email?.trim() || null,
    tipo: (tipos as string[]).includes(String(body.tipo)) ? (body.tipo as TipoCliente) : 'indefinido',
    origem: body.origem?.trim() || 'Cadastro manual',
  })
  return Response.json({ ok: true, cliente })
}
