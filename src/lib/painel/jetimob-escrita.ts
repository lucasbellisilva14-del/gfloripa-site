// Escrita no Jetimob a partir do painel.
//
// Situação (ver docs/painel/jetimob-api.md): a API pública documentada só
// permite CRIAR lead (POST /leads/{PUBLIC_KEY}); não há endpoint público
// conhecido para anotar histórico ou criar tarefa em um lead existente. Por
// isso o botão "Enviar para o Jetimob" fica atrás da flag PAINEL_JETIMOB_ENVIO
// e usa o POST de leads: o Jetimob agrupa pelo telefone/e-mail e registra a
// mensagem como novo atendimento do mesmo contato.
//
// Quando o Jetimob disponibilizar o MCP/API de escrita, troque a
// implementação de enviarNotaJetimob() mantendo a assinatura.

import { createLead } from '@/lib/jetimob'

export function envioJetimobHabilitado(): boolean {
  return process.env.PAINEL_JETIMOB_ENVIO === '1' && Boolean(process.env.JETIMOB_PUBLIC_KEY && process.env.JETIMOB_PRIVATE_KEY)
}

export type NotaJetimob = {
  nomeCliente: string
  telefone: string
  email?: string | null
  codigoImovel?: string | null
  texto: string
  corretorEmail?: string | null
}

export async function enviarNotaJetimob(n: NotaJetimob): Promise<void> {
  if (!envioJetimobHabilitado()) throw new Error('Envio ao Jetimob desabilitado (PAINEL_JETIMOB_ENVIO).')
  await createLead({
    full_name: n.nomeCliente,
    // o endpoint exige e-mail; sem e-mail real usamos um marcador estável por telefone
    email: n.email?.trim() || `${n.telefone.replace(/\D/g, '')}@sem-email.nagamboa.local`,
    phone: n.telefone,
    message: `[Painel do Corretor] ${n.texto}`,
    property_code: n.codigoImovel ?? undefined,
    responsible: n.corretorEmail ?? undefined,
    subject: 'Painel do Corretor: atualização de atendimento',
  })
}
