import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirTokenPonte } from '@/lib/painel/whatsapp-token'

// Sessão do WhatsApp guardada pelo painel. Só a ponte acessa, por token, e o
// conteúdo nunca é exposto a nenhuma tela.
//
// Desde novembro de 2026 a ponte guarda a sessão em disco próprio e não usa
// mais esta rota. Ela fica por compatibilidade, com limite de tamanho: a
// sessão do WhatsApp chega a megabytes, e reenviá-la a cada mudança consumiu
// a cota de transferência da Vercel (Fast Origin Transfer) da conta inteira.
const MAX_BYTES = 256 * 1024

export async function GET(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  return Response.json({ dados: await db.obterSessaoWhatsapp(auth.corretor.id) })
}

export async function PUT(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  const tamanho = Number(request.headers.get('content-length') ?? 0)
  if (tamanho > MAX_BYTES) {
    return Response.json({ error: `Sessão grande demais (${Math.round(tamanho / 1024)} KB; máximo ${MAX_BYTES / 1024} KB). Guarde a sessão em disco no serviço.` }, { status: 413 })
  }
  let body: { dados?: unknown }
  try {
    const texto = await request.text()
    if (texto.length > MAX_BYTES) return Response.json({ error: 'Sessão grande demais' }, { status: 413 })
    body = JSON.parse(texto)
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
