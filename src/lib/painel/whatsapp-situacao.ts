// Interpreta o que sabemos do serviço ponte e resume numa situação única para
// a tela, com a lista de verificações que explica o porquê. Puro e testável.

import type { EstadoWhatsapp, StatusWhatsapp } from './tipos'
import type { SaudePonte } from './whatsapp-ponte'

export type Situacao =
  | 'conectado'
  | 'aguardando_qr'
  | 'conectando'
  | 'desconectado'
  | 'servico_fora' // domínio direto configurado e não respondeu
  | 'sem_noticias' // sem domínio direto e o pulso parou
  | 'nao_configurado'

export type Verificacao = {
  chave: 'servico' | 'pareado' | 'endereco' | 'vendo' | 'entregando'
  rotulo: string
  ok: boolean | null // null = não dá para saber ainda
  detalhe: string
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  conectado: 'Conectado',
  aguardando_qr: 'Aguardando leitura do código',
  conectando: 'Conectando',
  desconectado: 'Desconectado',
  servico_fora: 'Serviço fora do ar',
  sem_noticias: 'Sem notícias do serviço',
  nao_configurado: 'Não configurado',
}

// O serviço manda um pulso a cada 30 s; com três perdidos, consideramos caído.
export const LIMITE_SEM_PULSO_MS = 95_000

export type Entrada = {
  estado: EstadoWhatsapp | null
  saude: SaudePonte | null // null quando não há domínio direto
  pontePronta: boolean
  agoraMs: number
  // origem desta página (ex.: https://www.nagamboaimoveis.com.br), para
  // conferir se o serviço aponta para cá
  origemPainel: string | null
}

export function situacaoWhatsapp(e: Entrada): { situacao: Situacao; verificacoes: Verificacao[]; msSemPulso: number | null } {
  if (!e.pontePronta) return { situacao: 'nao_configurado', verificacoes: [], msSemPulso: null }

  const statusInformado: StatusWhatsapp = e.estado?.status ?? 'desconectado'
  // agoraMs = 0 significa "ainda sem relógio" (renderização no servidor e a
  // primeira no navegador): confia no status informado e não acusa atraso
  const relogioDesconhecido = !e.agoraMs
  const atualizadoMs = e.estado?.atualizado_em ? Date.parse(e.estado.atualizado_em) : NaN
  const msSemPulso = !relogioDesconhecido && Number.isFinite(atualizadoMs) ? Math.max(0, e.agoraMs - atualizadoMs) : null
  const pulsoRecente = msSemPulso !== null && msSemPulso <= LIMITE_SEM_PULSO_MS

  let situacao: Situacao
  let servicoVivo: boolean | null
  if (relogioDesconhecido && !e.saude) {
    servicoVivo = null
    situacao = statusInformado
  } else if (e.saude) {
    servicoVivo = e.saude.alcancavel
    if (!e.saude.alcancavel) situacao = 'servico_fora'
    else if (e.saude.conectado) situacao = 'conectado'
    else situacao = statusInformado === 'conectado' ? 'conectando' : statusInformado
  } else {
    servicoVivo = msSemPulso === null ? null : pulsoRecente
    if (!pulsoRecente) situacao = msSemPulso === null ? 'desconectado' : 'sem_noticias'
    else situacao = statusInformado
  }

  const d = e.estado?.diagnostico ?? null
  const pareado = situacao === 'conectado'
  const apontaParaCa = d?.painel_url && e.origemPainel ? normalizar(d.painel_url) === normalizar(e.origemPainel) : null
  const conectadoHaMs = pareado && d?.desde && !relogioDesconhecido ? e.agoraMs - Date.parse(d.desde) : 0

  const verificacoes: Verificacao[] = [
    {
      chave: 'servico',
      rotulo: 'Serviço no ar',
      ok: servicoVivo,
      detalhe:
        servicoVivo === null
          ? 'Ainda sem notícia do serviço.'
          : servicoVivo
            ? d?.versao
              ? `Rodando a versão ${d.versao}${d.desde ? `, desde ${horaCurta(d.desde)}` : ''}.`
              : 'Respondendo.'
            : msSemPulso !== null && !e.saude
              ? `Último sinal há ${minutos(msSemPulso)}. Ele avisa a cada 30 segundos.`
              : e.saude?.erro
                ? `Não respondeu: ${e.saude.erro}.`
                : 'Não respondeu.',
    },
    {
      chave: 'pareado',
      rotulo: 'Pareado com o WhatsApp',
      ok: servicoVivo === false ? null : pareado,
      detalhe: pareado
        ? `Número ${e.estado?.numero ?? e.saude?.numero ?? 'conectado'}.`
        : situacao === 'aguardando_qr'
          ? 'Leia o código QR com o celular.'
          : servicoVivo === false
            ? 'Depende do serviço voltar.'
            : 'Sem sessão ativa.',
    },
    {
      chave: 'endereco',
      rotulo: 'Apontando para este painel',
      ok: apontaParaCa,
      detalhe:
        apontaParaCa === null
          ? 'Sem informação ainda.'
          : apontaParaCa
            ? d!.painel_url!
            : `Está mandando para ${d!.painel_url}, e esta tela é ${e.origemPainel}. Corrija PAINEL_URL no serviço.`,
    },
    {
      chave: 'vendo',
      rotulo: 'Vendo mensagens',
      ok: !pareado ? null : d && d.vistas > 0 ? true : conectadoHaMs > 2 * 60_000 ? false : null,
      detalhe: !d
        ? 'Sem diagnóstico ainda.'
        : d.vistas > 0
          ? `${d.vistas} recebida(s) da biblioteca, ${d.aceitas} aceita(s)${d.ultima_vista_em ? `, última às ${horaCurta(d.ultima_vista_em)}` : ''}.`
          : pareado
            ? 'Nenhuma mensagem chegou ao serviço desde que ele subiu. Mande um teste pelo celular.'
            : 'Depende do pareamento.',
    },
    {
      chave: 'entregando',
      rotulo: 'Entregando ao painel',
      ok: !d || d.aceitas === 0 ? null : d.falhas_envio === 0 || d.enviadas > 0,
      detalhe: !d
        ? 'Sem diagnóstico ainda.'
        : d.falhas_envio > 0
          ? `${d.enviadas} entregue(s), ${d.falhas_envio} falha(s). ${d.ultimo_erro ? `Último erro: ${d.ultimo_erro}` : ''}`
          : d.enviadas > 0
            ? `${d.enviadas} mensagem(ns) entregue(s) ao painel.`
            : 'Nada para entregar ainda.',
    },
  ]

  return { situacao, verificacoes, msSemPulso }
}

function normalizar(u: string): string {
  return u.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '')
}

function minutos(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 1) return 'menos de um minuto'
  if (m === 1) return '1 minuto'
  if (m < 120) return `${m} minutos`
  const h = Math.round(m / 60)
  return `${h} horas`
}

function horaCurta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(d)
}
