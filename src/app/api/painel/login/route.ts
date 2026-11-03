import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_SESSAO, corretorPadrao, criarTokenSessao, loginDisponivel, opcoesCookieSessao, validarSenha } from '@/lib/painel/auth'

// Login por senha única. Atraso fixo em caso de erro para dificultar força bruta.
export async function POST(request: NextRequest) {
  if (!loginDisponivel()) {
    return Response.json(
      { error: 'Login indisponível: configure PAINEL_SENHA e PAINEL_SESSION_SECRET no servidor.' },
      { status: 503 }
    )
  }
  let body: { senha?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const senha = String(body.senha ?? '')
  if (!senha || !validarSenha(senha)) {
    await new Promise((r) => setTimeout(r, 600))
    return Response.json({ error: 'Senha incorreta' }, { status: 401 })
  }
  const corretor = corretorPadrao()
  const token = await criarTokenSessao(corretor)
  if (!token) {
    return Response.json({ error: 'Configure PAINEL_SESSION_SECRET no servidor.' }, { status: 503 })
  }
  const store = await cookies()
  store.set(COOKIE_SESSAO, token, opcoesCookieSessao())
  return Response.json({ ok: true, corretor })
}
