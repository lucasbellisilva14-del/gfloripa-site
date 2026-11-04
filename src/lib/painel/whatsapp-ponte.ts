// Comunicação do painel com o serviço ponte (servicos/whatsapp).
//
// Dois caminhos, do mais rápido ao mais garantido:
//   1. Direto: se WHATSAPP_PONTE_URL estiver configurada (o domínio público do
//      serviço na hospedagem), o painel chama o serviço na hora, com o mesmo
//      token. Resposta imediata e saúde em tempo real.
//   2. Fila: o painel grava o comando no banco e o serviço o consome em até
//      cinco segundos. Funciona sem domínio público, mas só enquanto o
//      serviço estiver vivo.
// A tela usa o direto quando existe e cai para a fila quando não.

import type { ComandoWhatsapp } from './tipos'

const TEMPO_LIMITE_MS = 3000
// A tela consulta a cada 2 s enquanto não está estável; sem cache, cada
// consulta esperaria o tempo limite inteiro quando o endereço não responde.
const CACHE_SAUDE_MS = 8000
const global = globalThis as typeof globalThis & { __saudePonte?: { em: number; valor: SaudePonte | null } }

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

async function chamarPonte(caminho: string, init: RequestInit = {}): Promise<Response> {
  const base = urlPonte()
  if (!base) throw new Error('WHATSAPP_PONTE_URL não configurada')
  const token = process.env.PAINEL_WHATSAPP_TOKEN ?? ''
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS)
  try {
    return await fetch(`${base}${caminho}`, {
      ...init,
      signal: controle.signal,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    })
  } finally {
    clearTimeout(timer)
  }
}

// Saúde em tempo real. Nunca lança: a tela precisa saber que não alcançou.
export async function saudePonte(forcar = false): Promise<SaudePonte | null> {
  if (!urlPonte()) return null
  const agora = Date.now()
  if (!forcar && global.__saudePonte && agora - global.__saudePonte.em < CACHE_SAUDE_MS) return global.__saudePonte.valor
  const valor = await consultarSaude()
  global.__saudePonte = { em: agora, valor }
  return valor
}

async function consultarSaude(): Promise<SaudePonte> {
  try {
    const res = await chamarPonte('/saude')
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

export function esquecerSaude() {
  global.__saudePonte = undefined
}

// Tenta executar o comando na hora. Devolve true se o serviço confirmou.
export async function comandoDireto(comando: ComandoWhatsapp): Promise<boolean> {
  if (!urlPonte()) return false
  esquecerSaude() // depois de um comando, a próxima leitura de saúde deve ser fresca
  try {
    const res = await chamarPonte('/comando', { method: 'POST', body: JSON.stringify({ comando }) })
    return res.ok
  } catch {
    return false
  }
}
