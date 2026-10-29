import { cookies } from 'next/headers'
import { COOKIE_SESSAO } from '@/lib/painel/auth'

export async function POST() {
  const store = await cookies()
  store.delete(COOKIE_SESSAO)
  return Response.json({ ok: true })
}
