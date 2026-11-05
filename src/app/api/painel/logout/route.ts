import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO } from '@/lib/painel/auth'

export async function POST() {
  const store = await cookies()
  store.delete(COOKIE_SESSAO)
  return Response.json({ ok: true })
}

// Saída por link (ex.: conta desativada enquanto estava logado): limpa o
// cookie e volta ao login com o motivo, para a tela explicar.
export async function GET(request: NextRequest) {
  const store = await cookies()
  store.delete(COOKIE_SESSAO)
  const url = new URL('/painel/login', request.url)
  const motivo = request.nextUrl.searchParams.get('motivo')
  if (motivo) url.searchParams.set('motivo', motivo)
  return NextResponse.redirect(url)
}
