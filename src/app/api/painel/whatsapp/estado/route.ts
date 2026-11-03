import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirTokenPonte } from '@/lib/painel/whatsapp-token'
import { exigirCorretor } from '@/lib/painel/sessao'
import type { StatusWhatsapp } from '@/lib/painel/tipos'

const STATUS: StatusWhatsapp[] = ['desconectado', 'aguardando_qr', 'conectando', 'conectado']

// A ponte publica aqui o status da conexão e o QR; o painel só lê.
export async function POST(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  let body: { status?: string; qr?: string | null; numero?: string | null; detalhe?: string | null }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const status = (STATUS as string[]).includes(String(body.status)) ? (body.status as StatusWhatsapp) : undefined
  const db = await getDb()
  const estado = await db.salvarEstadoWhatsapp(auth.corretor.id, {
    status,
    qr: body.qr === undefined ? undefined : body.qr ? String(body.qr).slice(0, 20000) : null,
    numero: body.numero === undefined ? undefined : body.numero ? String(body.numero).replace(/\D/g, '') : null,
    detalhe: body.detalhe === undefined ? undefined : body.detalhe ? String(body.detalhe).slice(0, 500) : null,
  })
  return Response.json({ ok: true, estado })
}

// Leitura pela tela do painel (cookie de sessão).
export async function GET() {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  const estado = await db.obterEstadoWhatsapp(auth.corretor.id)
  return Response.json({ estado })
}
