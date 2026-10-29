import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO, verificarTokenSessao } from '@/lib/painel/auth'

// Protege a área interna do painel (/painel/*) e sua API (/api/painel/*).
// Só o login passa sem cookie. Páginas são redirecionadas ao login; a API
// responde 401. O site público não passa por aqui (ver matcher).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ehLogin = pathname === '/painel/login' || pathname === '/api/painel/login'

  const sessao = await verificarTokenSessao(request.cookies.get(COOKIE_SESSAO)?.value)

  if (ehLogin) {
    // já logado: manda direto para o painel
    if (sessao && pathname === '/painel/login') {
      return NextResponse.redirect(new URL('/painel', request.url))
    }
    return NextResponse.next()
  }

  if (sessao) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const url = new URL('/painel/login', request.url)
  if (pathname !== '/painel') url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/painel/:path*', '/api/painel/:path*'],
}
