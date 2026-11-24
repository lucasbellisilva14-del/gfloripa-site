// Autenticação das rotas usadas pelo serviço ponte (servicos/whatsapp) e
// resolução de qual ponte pertence a qual corretor.
//
// Cada corretor tem o próprio token (coluna corretores.whatsapp_token, gerado
// pelo gestor em Configurações > Equipe) e roda a própria instância da ponte
// com esse token. A variável PAINEL_WHATSAPP_TOKEN continua valendo para o
// gestor padrão, por compatibilidade com a instalação original.

import { corretorPadrao } from './auth'
import { getDb } from './db'
import type { CorretorLogado } from './tipos'

export type PonteDoCorretor = {
  token: string | null // segredo compartilhado com a instância da ponte
  url: string | null // endereço público da instância, para comandos e saúde na hora
}

export function tokenConfigurado(): boolean {
  return Boolean(process.env.PAINEL_WHATSAPP_TOKEN)
}

function comparaConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

export function gerarTokenPonte(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Devolve o corretor dono do token, ou uma resposta de erro pronta.
export async function exigirTokenPonte(request: Request): Promise<{ corretor: CorretorLogado } | { erro: Response }> {
  const cabecalho = request.headers.get('authorization') ?? ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : ''
  if (!token) return { erro: Response.json({ error: 'Token inválido' }, { status: 401 }) }

  const daVariavel = process.env.PAINEL_WHATSAPP_TOKEN
  if (daVariavel && comparaConstante(token, daVariavel)) return { corretor: corretorPadrao() }

  // tokens gerados pelo painel têm 64 caracteres hexadecimais
  if (/^[a-f0-9]{64}$/.test(token)) {
    try {
      const db = await getDb()
      const c = await db.obterCorretorPorTokenWhatsapp(token)
      if (c && c.ativo) {
        return { corretor: { id: c.id, nome: c.nome, email: c.email, usuario: c.usuario, papel: c.papel, jetimob_id: c.jetimob_id } }
      }
    } catch (err) {
      console.error('Painel: erro ao conferir token da ponte:', err)
    }
  }
  if (!daVariavel) {
    // sem variável e sem token no banco: a instalação ainda não foi feita
    return { erro: Response.json({ error: 'Token inválido ou ponte não configurada (gere o token em Configurações > Equipe)' }, { status: 401 }) }
  }
  return { erro: Response.json({ error: 'Token inválido' }, { status: 401 }) }
}

// Token e endereço da ponte de um corretor. Para o gestor padrão, cai nas
// variáveis de ambiente quando ele não tem valores próprios.
export async function ponteDoCorretor(corretor: Pick<CorretorLogado, 'id'>): Promise<PonteDoCorretor> {
  const padrao = corretorPadrao()
  let token: string | null = null
  let url: string | null = null
  try {
    const db = await getDb()
    const p = await db.obterPonteDoCorretor(corretor.id)
    token = p.token
    url = p.url
  } catch (err) {
    console.error('Painel: erro ao ler a ponte do corretor:', err)
  }
  if (corretor.id === padrao.id) {
    token = token ?? (process.env.PAINEL_WHATSAPP_TOKEN || null)
    url = url ?? ((process.env.WHATSAPP_PONTE_URL ?? '').trim().replace(/\/$/, '') || null)
  }
  return { token, url }
}
