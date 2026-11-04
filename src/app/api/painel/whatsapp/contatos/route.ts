import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirTokenPonte } from '@/lib/painel/whatsapp-token'

const MAX_POR_LOTE = 300

// A ponte manda nomes da agenda do celular (e nomes públicos) conforme a
// biblioteca os entrega. Serve para batizar e corrigir o nome das conversas,
// inclusive as que ficaram com o nome do próprio corretor por engano.
export async function POST(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  let body: { contatos?: unknown; meu_nome?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  if (!Array.isArray(body.contatos)) return Response.json({ error: 'Envie contatos[]' }, { status: 400 })
  if (body.contatos.length > MAX_POR_LOTE) return Response.json({ error: `Máximo de ${MAX_POR_LOTE} por lote` }, { status: 400 })

  const contatos: { wa_chat_id: string; nome: string }[] = []
  for (const bruto of body.contatos) {
    if (typeof bruto !== 'object' || bruto === null) continue
    const c = bruto as Record<string, unknown>
    const wa_chat_id = String(c.wa_chat_id ?? '').trim()
    const nome = String(c.nome ?? '').trim().slice(0, 120)
    if (!wa_chat_id || !nome) continue
    if (wa_chat_id.includes('@g.us') || wa_chat_id.includes('broadcast') || wa_chat_id.includes('@newsletter')) continue
    contatos.push({ wa_chat_id, nome })
  }
  const meuNome = typeof body.meu_nome === 'string' ? body.meu_nome.slice(0, 120) : null
  const db = await getDb()
  const renomeadas = contatos.length ? await db.renomearChatsWhatsapp(auth.corretor.id, contatos, meuNome) : 0
  return Response.json({ ok: true, recebidos: contatos.length, renomeadas })
}
