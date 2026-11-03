// Leitura da sessão em server components e route handlers (next/headers).
// O proxy já barra quem não está logado; aqui só recuperamos quem é.
import { cookies } from 'next/headers'
import { COOKIE_SESSAO, verificarTokenSessao } from './auth'
import type { CorretorLogado } from './tipos'

export async function getCorretorLogado(): Promise<CorretorLogado | null> {
  const store = await cookies()
  const sessao = await verificarTokenSessao(store.get(COOKIE_SESSAO)?.value)
  if (!sessao) return null
  return { id: sessao.id, nome: sessao.nome, email: sessao.email ?? null }
}

// Para rotas de API: devolve o corretor ou uma resposta 401 pronta.
export async function exigirCorretor(): Promise<{ corretor: CorretorLogado } | { erro: Response }> {
  const corretor = await getCorretorLogado()
  if (!corretor) return { erro: Response.json({ error: 'Não autenticado' }, { status: 401 }) }
  return { corretor }
}
