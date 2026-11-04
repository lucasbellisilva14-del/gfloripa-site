import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirTokenPonte } from '@/lib/painel/whatsapp-token'
import type { MensagemRecebida } from '@/lib/painel/tipos'

const MAX_POR_LOTE = 200
const MAX_TEXTO = 8000

// Recebe mensagens do serviço ponte. Autenticada por token, não por cookie:
// o proxy libera esta rota e a verificação acontece aqui.
export async function POST(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro

  let body: { mensagens?: unknown; meu_nome?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  if (!Array.isArray(body.mensagens)) return Response.json({ error: 'Envie mensagens[]' }, { status: 400 })
  if (body.mensagens.length > MAX_POR_LOTE) {
    return Response.json({ error: `Máximo de ${MAX_POR_LOTE} mensagens por lote` }, { status: 400 })
  }

  const mensagens: MensagemRecebida[] = []
  for (const bruta of body.mensagens) {
    if (typeof bruta !== 'object' || bruta === null) continue
    const m = bruta as Record<string, unknown>
    const wa_chat_id = String(m.wa_chat_id ?? '').trim()
    const wa_id = String(m.wa_id ?? '').trim()
    const texto = String(m.texto ?? '').trim().slice(0, MAX_TEXTO)
    const data = String(m.data ?? '')
    if (!wa_chat_id || !wa_id || !texto) continue
    // grupos e transmissões não interessam ao painel
    if (wa_chat_id.includes('@g.us') || wa_chat_id.includes('broadcast') || wa_chat_id.includes('@newsletter')) continue
    if (Number.isNaN(new Date(data).getTime())) continue
    mensagens.push({
      wa_chat_id,
      wa_id,
      direcao: m.direcao === 'saida' ? 'saida' : 'entrada',
      nome: m.nome ? String(m.nome).slice(0, 120) : null,
      autor: m.autor ? String(m.autor).slice(0, 120) : null,
      texto,
      data: new Date(data).toISOString(),
    })
  }
  if (!mensagens.length) return Response.json({ ok: true, novas: 0 })

  const db = await getDb()
  const meuNome = typeof body.meu_nome === 'string' ? body.meu_nome.slice(0, 120) : null
  const novas = await db.registrarMensagensWhatsapp(auth.corretor.id, mensagens, { meuNome })
  return Response.json({ ok: true, novas, recebidas: mensagens.length })
}
