import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_SESSAO, criarTokenSessao, loginDisponivel, opcoesCookieSessao } from '@/lib/painel/auth'
import { autenticar } from '@/lib/painel/login'

// Login por usuário e senha (ver lib/painel/login.ts). Atraso fixo em caso de
// erro para dificultar força bruta.
export async function POST(request: NextRequest) {
  if (!loginDisponivel()) {
    return Response.json(
      { error: 'Login indisponível: configure PAINEL_SENHA e PAINEL_SESSION_SECRET no servidor.' },
      { status: 503 }
    )
  }
  let body: { usuario?: string; senha?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const senha = String(body.senha ?? '')
  const usuario = String(body.usuario ?? '').slice(0, 60)
  if (!senha) return Response.json({ error: 'Informe a senha' }, { status: 400 })

  const resultado = await autenticar(usuario, senha)
  if ('erro' in resultado) {
    await new Promise((r) => setTimeout(r, 600))
    return Response.json({ error: resultado.erro }, { status: resultado.status })
  }
  const token = await criarTokenSessao(resultado.corretor)
  if (!token) {
    return Response.json({ error: 'Configure PAINEL_SESSION_SECRET no servidor.' }, { status: 503 })
  }
  const store = await cookies()
  store.set(COOKIE_SESSAO, token, opcoesCookieSessao())
  return Response.json({ ok: true, corretor: resultado.corretor })
}
