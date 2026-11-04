import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'

// Mensagens de uma conversa, para o corretor ler na própria tela antes de
// mandar analisar.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const { id } = await params
  const db = await getDb()
  const chat = await db.obterChatWhatsapp(id)
  if (!chat || chat.corretor_id !== auth.corretor.id) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }
  const limite = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limite') ?? 200)))
  const mensagens = await db.listarMensagensDoChat(chat.id, limite)
  return Response.json({ chat, mensagens })
}
