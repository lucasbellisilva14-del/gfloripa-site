// Leitura da sessão em server components e route handlers (next/headers).
// O proxy já barra quem não está logado; aqui só recuperamos quem é e
// conferimos se a conta continua ativa.
import { cookies } from 'next/headers'
import { COOKIE_SESSAO, verificarTokenSessao } from './auth'
import { getDb } from './db'
import type { CorretorLogado } from './tipos'

const CACHE_ATIVO_MS = 60_000
const global = globalThis as typeof globalThis & { __painelAtivo?: Map<number, { ativo: boolean; ate: number }> }

// Conta desativada pelo gestor deixa de valer mesmo com cookie válido.
// Consulta o banco no máximo uma vez por minuto por corretor.
async function contaAtiva(id: number): Promise<boolean> {
  const cache = (global.__painelAtivo ??= new Map())
  const c = cache.get(id)
  if (c && c.ate > Date.now()) return c.ativo
  let ativo = true
  try {
    const db = await getDb()
    const linha = await db.obterCorretor(id)
    if (linha) ativo = linha.ativo
  } catch {
    // tabela indisponível: não derruba quem está logado
  }
  cache.set(id, { ativo, ate: Date.now() + CACHE_ATIVO_MS })
  return ativo
}

export function esquecerCacheAtivo(id: number) {
  global.__painelAtivo?.delete(id)
}

export async function getCorretorLogado(): Promise<CorretorLogado | null> {
  const store = await cookies()
  const sessao = await verificarTokenSessao(store.get(COOKIE_SESSAO)?.value)
  if (!sessao) return null
  if (!(await contaAtiva(sessao.id))) return null
  return {
    id: sessao.id,
    nome: sessao.nome,
    email: sessao.email ?? null,
    usuario: sessao.usuario,
    papel: sessao.papel ?? 'corretor',
    jetimob_id: sessao.jetimob_id ?? null,
  }
}

// Para rotas de API: devolve o corretor ou uma resposta 401 pronta.
export async function exigirCorretor(): Promise<{ corretor: CorretorLogado } | { erro: Response }> {
  const corretor = await getCorretorLogado()
  if (!corretor) return { erro: Response.json({ error: 'Não autenticado' }, { status: 401 }) }
  return { corretor }
}

// Rotas da equipe: só o gestor.
export async function exigirGestor(): Promise<{ corretor: CorretorLogado } | { erro: Response }> {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth
  if (auth.corretor.papel !== 'gestor') return { erro: Response.json({ error: 'Só o gestor pode fazer isso' }, { status: 403 }) }
  return auth
}
