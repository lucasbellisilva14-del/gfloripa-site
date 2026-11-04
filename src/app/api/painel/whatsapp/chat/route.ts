import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'

// Lista as conversas capturadas (a tela recarrega sozinha enquanto espera o
// pareamento) e permite arquivar uma conversa que não interessa.
export async function GET(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  const incluir = request.nextUrl.searchParams.get('arquivados') === '1'
  const chats = await db.listarChatsWhatsapp(auth.corretor.id, incluir)
  const estado = await db.obterEstadoWhatsapp(auth.corretor.id)
  return Response.json({ chats, estado })
}

export async function PATCH(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  let body: { chat_id?: string; arquivado?: boolean; nome?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const db = await getDb()
  const chat = body.chat_id ? await db.obterChatWhatsapp(body.chat_id) : null
  if (!chat || chat.corretor_id !== auth.corretor.id) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }
  const atualizado = await db.atualizarChatWhatsapp(chat.id, {
    ...(typeof body.arquivado === 'boolean' ? { arquivado: body.arquivado } : {}),
    ...(body.nome?.trim() ? { nome: body.nome.trim().slice(0, 120) } : {}),
  })
  return Response.json({ ok: true, chat: atualizado })
}
