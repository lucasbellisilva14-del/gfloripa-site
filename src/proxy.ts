import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO, verificarTokenSessao } from '@/lib/painel/auth'
import { decidirPorHost } from '@/lib/painel/hospedagem'

// Protege a área interna do painel (/painel/*) e sua API (/api/painel/*).
// Só o login passa sem cookie. Páginas são redirecionadas ao login; a API
// responde 401. O site público não passa por aqui (ver matcher).
// Rotas usadas pelo serviço ponte do WhatsApp: não têm cookie de sessão e se
// autenticam por token (PAINEL_WHATSAPP_TOKEN) dentro da própria rota.
const ROTAS_TOKEN = [
  '/api/painel/whatsapp/entrada',
  '/api/painel/whatsapp/estado',
  '/api/painel/whatsapp/sessao',
  '/api/painel/whatsapp/comando',
  '/api/painel/whatsapp/contatos',
]

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Site na Vercel, painel no Railway: com PAINEL_HOST, cada host cuida do
  // seu (ver docs/painel/hospedagem.md). Sem a variável, nada muda.
  const decisao = decidirPorHost({ host: request.headers.get('host'), pathname, search, painelHost: process.env.PAINEL_HOST })
  if (decisao.acao === 'redirecionar') return NextResponse.redirect(decisao.destino, decisao.permanente ? 308 : 307)
  if (pathname === '/') return NextResponse.next()

  const ehLogin = pathname === '/painel/login' || pathname === '/api/painel/login'

  if (ROTAS_TOKEN.includes(pathname)) return NextResponse.next()

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

// As rotas da ponte ficam fora do matcher: o proxy não precisa rodar nelas
// (a própria rota confere o token) e, na Vercel, o tráfego que passa pelo
// proxy conta como transferência também. A lista ROTAS_TOKEN acima continua
// como defesa, caso o matcher mude.
// A raiz entra no matcher só para o host do painel levar ao /painel; no site
// ela segue direto. As rotas da ponte, no host do painel, chegam direto na
// rota (o token é conferido lá).
export const config = {
  matcher: ['/', '/painel/:path*', '/api/painel/((?!whatsapp/(?:entrada|estado|sessao|comando|contatos)$).*)'],
}
