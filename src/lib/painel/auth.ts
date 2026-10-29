// Autenticação simples do painel: senha única (PAINEL_SENHA) e cookie de
// sessão assinado com HMAC-SHA256 (PAINEL_SESSION_SECRET). Usa Web Crypto
// para funcionar tanto no proxy quanto nas rotas e server components.
//
// Modo demonstração: sem PAINEL_SENHA em desenvolvimento (ou com
// PAINEL_DEMO=1), a senha "demo" entra. Em produção sem PAINEL_SENHA o login
// fica desabilitado, para o painel nunca ficar aberto por esquecimento.

import type { CorretorLogado } from './tipos'

export const COOKIE_SESSAO = 'painel_sessao'
const DURACAO_SESSAO_SEG = 60 * 60 * 24 * 14 // 14 dias

export type Sessao = CorretorLogado & { exp: number }

export function modoDemoLogin(): boolean {
  if (process.env.PAINEL_SENHA) return false
  return process.env.PAINEL_DEMO === '1' || process.env.NODE_ENV !== 'production'
}

// Variáveis que faltam para o login funcionar. Lista vazia = tudo certo.
// Serve para a tela de login dizer exatamente o que configurar, em vez de
// repetir a lista inteira: na Vercel o erro quase sempre é uma variável que
// ficou só no ambiente Production, ou um Redeploy que não foi feito.
export function variaveisFaltando(): string[] {
  if (modoDemoLogin()) return []
  const faltando: string[] = []
  if (!process.env.PAINEL_SENHA) faltando.push('PAINEL_SENHA')
  if (!process.env.PAINEL_SESSION_SECRET) faltando.push('PAINEL_SESSION_SECRET')
  return faltando
}

export function loginDisponivel(): boolean {
  return variaveisFaltando().length === 0
}

function segredo(): string | null {
  if (process.env.PAINEL_SESSION_SECRET) return process.env.PAINEL_SESSION_SECRET
  // Em demo, um segredo fixo de desenvolvimento é aceitável: não há dado real.
  if (modoDemoLogin()) return 'painel-demo-segredo-nao-usar-em-producao'
  return null
}

// Corretor padrão do painel. Para multiusuário, trocar por consulta a uma
// tabela de corretores (ver docs/painel/README.md, roadmap fase 2).
export function corretorPadrao(): CorretorLogado {
  return {
    id: Number(process.env.PAINEL_CORRETOR_ID ?? 77723),
    nome: process.env.PAINEL_CORRETOR_NOME ?? 'Lucas',
    email: process.env.PAINEL_CORRETOR_EMAIL ?? null,
  }
}

export function validarSenha(senha: string): boolean {
  const esperada = process.env.PAINEL_SENHA
  if (esperada) return comparaConstante(senha, esperada)
  if (modoDemoLogin()) return comparaConstante(senha, 'demo')
  return false
}

function comparaConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  }
  return diff === 0
}

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function chaveHmac(): Promise<CryptoKey | null> {
  const s = segredo()
  if (!s) return null
  return crypto.subtle.importKey('raw', new TextEncoder().encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function criarTokenSessao(corretor: CorretorLogado): Promise<string | null> {
  const key = await chaveHmac()
  if (!key) return null
  const sessao: Sessao = { ...corretor, exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEG }
  const payload = new TextEncoder().encode(JSON.stringify(sessao))
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload))
  return `${b64url(payload)}.${b64url(assinatura)}`
}

export async function verificarTokenSessao(token: string | undefined | null): Promise<Sessao | null> {
  if (!token) return null
  const [p, s] = token.split('.')
  if (!p || !s) return null
  const key = await chaveHmac()
  if (!key) return null
  try {
    const payload = deB64url(p)
    const ok = await crypto.subtle.verify('HMAC', key, deB64url(s), payload)
    if (!ok) return null
    const sessao = JSON.parse(new TextDecoder().decode(payload)) as Sessao
    if (!sessao?.exp || sessao.exp < Math.floor(Date.now() / 1000)) return null
    if (typeof sessao.id !== 'number' || typeof sessao.nome !== 'string') return null
    return sessao
  } catch {
    return null
  }
}

export function opcoesCookieSessao() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO_SESSAO_SEG,
  }
}
