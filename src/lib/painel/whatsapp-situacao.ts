// Interpreta o que sabemos do serviço ponte e resume numa situação única para
// a tela, com a lista de verificações que explica o porquê. Puro e testável.
//
// Duas fontes, e a regra de precedência entre elas:
//   - o pulso gravado no banco (o serviço avisa a cada 30 s pela fila);
//   - a saúde direta, quando WHATSAPP_PONTE_URL está configurada.
// Pulso recente prova que o serviço está vivo mesmo que o endereço direto não
// responda: nesse caso o problema é o endereço, não o serviço, e a tela deve
// dizer isso em vez de esconder o QR atrás de um "fora do ar" falso.

import type { EstadoWhatsapp, StatusWhatsapp } from './tipos'
import type { SaudePonte } from './whatsapp-ponte'

export type Situacao =
  | 'conectado'
  | 'aguardando_qr'
  | 'conectando'
  | 'desconectado'
  | 'servico_fora' // nem o endereço direto responde nem há pulso recente
  | 'sem_noticias' // sem endereço direto e o pulso parou
  | 'nao_configurado'

export type Verificacao = {
  chave: 'servico' | 'direto' | 'pareado' | 'endereco' | 'vendo' | 'entregando'
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
  saude: SaudePonte | null // null quando não há endereço direto configurado
  pontePronta: boolean
  agoraMs: number // 0 = ainda sem relógio (servidor e primeira renderização)
  origemPainel: string | null // origem desta página, para conferir o PAINEL_URL do serviço
  urlDireta?: string | null // WHATSAPP_PONTE_URL, só para aparecer na explicação
}

export type Leitura = {
  situacao: Situacao
  verificacoes: Verificacao[]
  msSemPulso: number | null
  servicoVivo: boolean | null
  mostrarQr: boolean
}

export function situacaoWhatsapp(e: Entrada): Leitura {
  if (!e.pontePronta) return { situacao: 'nao_configurado', verificacoes: [], msSemPulso: null, servicoVivo: null, mostrarQr: false }

  const statusInformado: StatusWhatsapp = e.estado?.status ?? 'desconectado'
  const relogioDesconhecido = !e.agoraMs
  const atualizadoMs = e.estado?.atualizado_em ? Date.parse(e.estado.atualizado_em) : NaN
  const msSemPulso = !relogioDesconhecido && Number.isFinite(atualizadoMs) ? Math.max(0, e.agoraMs - atualizadoMs) : null
  const pulsoRecente = msSemPulso !== null && msSemPulso <= LIMITE_SEM_PULSO_MS
  const diretoResponde = e.saude?.alcancavel === true
  const diretoFalhou = e.saude !== null && e.saude.alcancavel === false

  // Vivo se qualquer uma das fontes prova; morto só se nenhuma prova.
  let servicoVivo: boolean | null
  if (diretoResponde || pulsoRecente) servicoVivo = true
  else if (relogioDesconhecido && !diretoFalhou) servicoVivo = null
  else if (msSemPulso === null && !diretoFalhou) servicoVivo = null
  else servicoVivo = false

  let situacao: Situacao
  if (servicoVivo === false) situacao = diretoFalhou ? 'servico_fora' : 'sem_noticias'
  else if (diretoResponde && e.saude!.conectado) situacao = 'conectado'
  else if (diretoResponde && statusInformado === 'conectado') situacao = 'conectando' // o banco está atrasado em relação ao serviço
  else situacao = statusInformado

  const d = e.estado?.diagnostico ?? null
  const pareado = situacao === 'conectado'
  const mostrarQr = situacao === 'aguardando_qr' && Boolean(e.estado?.qr)
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
            ? `${diretoResponde ? 'Respondendo agora' : `Último sinal há ${minutos(msSemPulso ?? 0)}`}${d?.versao ? `, versão ${d.versao}` : ''}${d?.desde ? `, no ar desde ${horaCurta(d.desde)}` : ''}.`
            : msSemPulso !== null
              ? `Último sinal há ${minutos(msSemPulso)}; ele avisa a cada 30 segundos.${e.saude?.erro ? ` Endereço direto: ${e.saude.erro}.` : ''}`
              : e.saude?.erro
                ? `Não respondeu: ${e.saude.erro}.`
                : 'Não respondeu.',
    },
  ]

  if (e.saude !== null) {
    verificacoes.push({
      chave: 'direto',
      rotulo: 'Endereço direto do serviço',
      ok: diretoResponde,
      detalhe: diretoResponde
        ? `${e.urlDireta ?? 'WHATSAPP_PONTE_URL'} responde; os botões agem na hora.`
        : `${e.urlDireta ?? 'WHATSAPP_PONTE_URL'} não respondeu (${e.saude!.erro ?? 'sem resposta'}). ${
            servicoVivo
              ? 'O serviço está vivo pela outra via, então os botões funcionam pela fila, com até 5 segundos de atraso. Confira no Railway se o domínio foi gerado para o serviço certo e para a porta em que ele escuta.'
              : 'Confira se o serviço está no ar na hospedagem.'
          }`,
    })
  }

  verificacoes.push(
    {
      chave: 'pareado',
      rotulo: 'Pareado com o WhatsApp',
      ok: servicoVivo === false ? null : pareado,
      detalhe: pareado
        ? `Número ${e.estado?.numero ?? e.saude?.numero ?? 'conectado'}.`
        : situacao === 'aguardando_qr'
          ? 'Leia o código QR com o celular.'
          : situacao === 'conectando'
            ? 'Conectando agora.'
            : servicoVivo === false
              ? 'Depende do serviço voltar.'
              : 'Sem sessão ativa. Use "Parear de novo" para gerar o código.',
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
    }
  )

  return { situacao, verificacoes, msSemPulso, servicoVivo, mostrarQr }
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
