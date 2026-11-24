// Comunicação do painel com o serviço ponte (servicos/whatsapp) de um corretor.
//
// Dois caminhos, do mais rápido ao mais garantido:
//   1. Direto: se o corretor tem o endereço público da sua instância (coluna
//      whatsapp_ponte_url, ou WHATSAPP_PONTE_URL para o gestor padrão), o
//      painel chama o serviço na hora, com o token dele. Resposta imediata e
//      saúde em tempo real.
//   2. Fila: o painel grava o comando no banco e o serviço o consome em até
//      trinta segundos. Funciona sem domínio público, mas só enquanto o
//      serviço estiver vivo.
// A tela usa o direto quando existe e cai para a fila quando não.

import type { ComandoWhatsapp } from './tipos'
import type { PonteDoCorretor } from './whatsapp-token'

const TEMPO_LIMITE_MS = 3000
// A tela consulta a cada 2 s enquanto não está estável; sem cache, cada
// consulta esperaria o tempo limite inteiro quando o endereço não responde.
const CACHE_SAUDE_MS = 8000
const global = globalThis as typeof globalThis & { __saudePonte?: Map<string, { em: number; valor: SaudePonte | null }> }

export function urlPonte(): string | null {
  const u = (process.env.WHATSAPP_PONTE_URL ?? '').trim().replace(/\/$/, '')
  return u || null
}

export type SaudePonte = {
  alcancavel: boolean
  conectado: boolean
  numero: string | null
  fila: number
  desde: string | null
  versao: string | null
  erro: string | null
}

async function chamarPonte(ponte: PonteDoCorretor, caminho: string, init: RequestInit = {}): Promise<Response> {
  if (!ponte.url) throw new Error('endereço da ponte não configurado')
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS)
  try {
    return await fetch(`${ponte.url}${caminho}`, {
      ...init,
      signal: controle.signal,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ponte.token ?? ''}`, ...(init.headers ?? {}) },
    })
  } finally {
    clearTimeout(timer)
  }
}

// Saúde em tempo real. Nunca lança: a tela precisa saber que não alcançou.
export async function saudePonte(ponte: PonteDoCorretor, forcar = false): Promise<SaudePonte | null> {
  if (!ponte.url) return null
  const cache = (global.__saudePonte ??= new Map())
  const agora = Date.now()
  const guardado = cache.get(ponte.url)
  if (!forcar && guardado && agora - guardado.em < CACHE_SAUDE_MS) return guardado.valor
  const valor = await consultarSaude(ponte)
  cache.set(ponte.url, { em: agora, valor })
  return valor
}

async function consultarSaude(ponte: PonteDoCorretor): Promise<SaudePonte> {
  try {
    const res = await chamarPonte(ponte, '/saude')
    if (!res.ok) return { alcancavel: false, conectado: false, numero: null, fila: 0, desde: null, versao: null, erro: `HTTP ${res.status}` }
    const b = (await res.json()) as Partial<SaudePonte>
    return {
      alcancavel: true,
      conectado: Boolean(b.conectado),
      numero: b.numero ?? null,
      fila: Number(b.fila ?? 0),
      desde: b.desde ?? null,
      versao: b.versao ?? null,
      erro: null,
    }
  } catch (err) {
    return {
      alcancavel: false,
      conectado: false,
      numero: null,
      fila: 0,
      desde: null,
      versao: null,
      erro: err instanceof Error && err.name === 'AbortError' ? 'sem resposta em 3 segundos' : 'não alcançado',
    }
  }
}

export function esquecerSaude(url?: string | null) {
  if (url) global.__saudePonte?.delete(url)
  else global.__saudePonte = undefined
}

// Tenta executar o comando na hora. Devolve true só se o serviço confirmou
// de fato ({ ok: true }): um build antigo respondia 200 a qualquer rota sem
// executar nada, e isso passava por sucesso.
export async function comandoDireto(ponte: PonteDoCorretor, comando: ComandoWhatsapp): Promise<boolean> {
  if (!ponte.url) return false
  esquecerSaude(ponte.url) // depois de um comando, a próxima leitura de saúde deve ser fresca
  try {
    const res = await chamarPonte(ponte, '/comando', { method: 'POST', body: JSON.stringify({ comando }) })
    if (!res.ok) return false
    const b = (await res.json().catch(() => null)) as { ok?: unknown; comando?: unknown } | null
    return b?.ok === true && b.comando === comando
  } catch {
    return false
  }
}
