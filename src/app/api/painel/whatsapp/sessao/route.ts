import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirTokenPonte } from '@/lib/painel/whatsapp-token'

// Sessão do WhatsApp (credenciais do Baileys) guardada pelo painel para o
// serviço ponte reiniciar sem parear de novo. Só a ponte acessa, por token.
// O conteúdo é segredo: nunca é exposto a nenhuma tela.
export async function GET(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  return Response.json({ dados: await db.obterSessaoWhatsapp(auth.corretor.id) })
}

export async function PUT(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  let body: { dados?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  if (!body.dados) return Response.json({ error: 'Envie dados' }, { status: 400 })
  const db = await getDb()
  await db.salvarSessaoWhatsapp(auth.corretor.id, body.dados)
  return Response.json({ ok: true })
}

// Usado quando o WhatsApp encerra a sessão (logout pelo celular): limpa as
// credenciais para o próximo início pedir um QR novo.
export async function DELETE(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  await db.apagarSessaoWhatsapp(auth.corretor.id)
  await db.salvarEstadoWhatsapp(auth.corretor.id, { status: 'desconectado', qr: null, numero: null })
  return Response.json({ ok: true })
}
