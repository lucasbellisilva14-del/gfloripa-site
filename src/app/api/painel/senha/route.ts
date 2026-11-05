import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirCorretor } from '@/lib/painel/sessao'
import { conferirSenhaAtual } from '@/lib/painel/login'
import { gerarHashSenha, validarForcaSenha } from '@/lib/painel/senha'

// Qualquer corretor troca a própria senha informando a atual.
export async function POST(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  let body: { senha_atual?: string; nova_senha?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const atual = String(body.senha_atual ?? '')
  const nova = String(body.nova_senha ?? '')
  const problema = validarForcaSenha(nova)
  if (problema) return Response.json({ error: problema }, { status: 400 })
  if (!(await conferirSenhaAtual(auth.corretor, atual))) {
    await new Promise((r) => setTimeout(r, 600))
    return Response.json({ error: 'Senha atual incorreta' }, { status: 401 })
  }
  const db = await getDb()
  try {
    const corretor = await db.atualizarCorretor(auth.corretor.id, { senha_hash: await gerarHashSenha(nova) })
    if (!corretor) {
      return Response.json({ error: 'Sua conta ainda não está na tabela de corretores. Aplique a migration e tente de novo.' }, { status: 409 })
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: `Não foi possível salvar: ${(err as Error).message}` }, { status: 503 })
  }
}
