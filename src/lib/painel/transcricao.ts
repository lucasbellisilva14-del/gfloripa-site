// Monta a transcrição de uma conversa do WhatsApp no mesmo formato que o
// corretor colaria na mão, para a I.A. receber sempre a mesma coisa.

import type { ChatWhatsapp, MensagemWhatsapp } from './tipos'

const FUSO = 'America/Sao_Paulo'

export function montarTranscricao(chat: ChatWhatsapp, mensagens: MensagemWhatsapp[], corretorNome: string): string {
  const nomeCliente = chat.nome?.trim() || chat.telefone || 'Cliente'
  return mensagens
    .map((m) => {
      const quando = new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(m.data))
      const quem = m.direcao === 'saida' ? corretorNome : (m.autor?.trim() || nomeCliente)
      return `[${quando}] ${quem}: ${m.texto}`
    })
    .join('\n')
}

// Data da última mensagem, em AAAA-MM-DD, para a I.A. resolver "sexta" e
// "amanhã" a partir do fim da conversa.
export function dataDaConversa(mensagens: MensagemWhatsapp[]): string {
  const ultima = mensagens[mensagens.length - 1]
  const d = ultima ? new Date(ultima.data) : new Date()
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
