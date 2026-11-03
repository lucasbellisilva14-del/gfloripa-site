import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { normalizarDataLembrete } from '@/lib/painel/analise-schema'
import { dataIsoLocal, paraData } from '@/lib/painel/formato'

export async function GET(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  const status = request.nextUrl.searchParams.get('status')
  const lembretes = await db.listarLembretes({
    corretor_id: auth.corretor.id,
    status: status === 'pendente' || status === 'concluido' || status === 'cancelado' ? status : undefined,
  })
  return Response.json({ lembretes })
}

// Cria um lembrete (detectado pela I.A. ou manual).
export async function POST(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  let body: { titulo?: string; data?: string; descricao?: string; cliente_id?: string; analise_id?: string; origem?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const titulo = String(body.titulo ?? '').trim()
  const data = normalizarDataLembrete(body.data)
  if (!titulo || !data) return Response.json({ error: 'Informe título e data válidos' }, { status: 400 })
  const db = await getDb()
  // evita duplicar: mesmo cliente, mesmo título e mesmo dia, ainda pendente
  const dia = (iso: string) => {
    const d = paraData(iso)
    return d ? dataIsoLocal(d) : iso.slice(0, 10)
  }
  const pendentes = await db.listarLembretes({ corretor_id: auth.corretor.id, status: 'pendente', cliente_id: body.cliente_id || undefined })
  const igual = pendentes.find((l) => l.titulo.trim().toLowerCase() === titulo.toLowerCase() && dia(l.data) === dia(data))
  if (igual) return Response.json({ ok: true, lembrete: igual, duplicado: true })
  const lembrete = await db.criarLembrete({
    corretor_id: auth.corretor.id,
    titulo,
    data,
    descricao: body.descricao?.trim() || null,
    cliente_id: body.cliente_id || null,
    analise_id: body.analise_id || null,
    origem: body.origem === 'ia' ? 'ia' : 'manual',
  })
  return Response.json({ ok: true, lembrete })
}
