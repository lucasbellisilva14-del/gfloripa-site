// Autenticação das rotas usadas pelo serviço ponte (servicos/whatsapp).
// A ponte não tem cookie de sessão: ela se identifica com um token
// compartilhado (PAINEL_WHATSAPP_TOKEN), enviado no cabeçalho Authorization.

import { corretorPadrao } from './auth'
import type { CorretorLogado } from './tipos'

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

// Devolve o corretor da ponte, ou uma resposta de erro pronta.
export function exigirTokenPonte(request: Request): { corretor: CorretorLogado } | { erro: Response } {
  const esperado = process.env.PAINEL_WHATSAPP_TOKEN
  if (!esperado) {
    return { erro: Response.json({ error: 'Ponte do WhatsApp desabilitada (PAINEL_WHATSAPP_TOKEN ausente)' }, { status: 503 }) }
  }
  const cabecalho = request.headers.get('authorization') ?? ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : ''
  if (!token || !comparaConstante(token, esperado)) {
    return { erro: Response.json({ error: 'Token inválido' }, { status: 401 }) }
  }
  return { corretor: corretorPadrao() }
}
