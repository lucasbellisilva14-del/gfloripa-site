// Relatório da equipe pela I.A.: lê a visão consolidada (lib/painel/equipe.ts)
// mais as análises recentes de cada corretor e devolve um diagnóstico
// estruturado: pontos fortes e fracos da equipe, o que falta, prioridades e
// um parecer por corretor. Fica guardado em config (chave relatorio_equipe)
// até o gestor pedir outro. Sem ANTHROPIC_API_KEY, monta um relatório de
// demonstração a partir dos próprios números.

import type { PainelDb } from './db'
import { estimarCustoUsd, modeloAnalise } from './analise'
import { extrairJson } from './analise-schema'
import { obterPadraoAtendimento } from './padrao-atendimento'
import type { VisaoEquipe } from './equipe'
import { ROTULO_ESTAGIO, ROTULO_TEMPERATURA } from './tipos'

export const CHAVE_RELATORIO = 'relatorio_equipe'
const DIAS_PERIODO = 30
const MAX_ANALISES_POR_CORRETOR = 8

export type ParecerCorretor = {
  corretor_id: number
  nome: string
  resumo: string
  nota: number | null
  pontos_fortes: string[]
  pontos_fracos: string[]
  recomendacoes: string[]
}

export type RelatorioEquipe = {
  resumo_geral: string
  nota_equipe: number
  pontos_fortes: string[]
  pontos_fracos: string[]
  o_que_falta: string[]
  prioridades: string[]
  por_corretor: ParecerCorretor[]
  clientes_em_risco: { cliente: string; corretor: string; motivo: string }[]
}

export type RelatorioGuardado = {
  relatorio: RelatorioEquipe
  gerado_em: string
  modelo: string
  custo_usd: number
  demo: boolean
  periodo_dias: number
  analises_consideradas: number
}

const str = { type: 'string' } as const
const listaStr = { type: 'array', items: str } as const

export const RELATORIO_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumo_geral', 'nota_equipe', 'pontos_fortes', 'pontos_fracos', 'o_que_falta', 'prioridades', 'por_corretor', 'clientes_em_risco'],
  properties: {
    resumo_geral: { ...str, description: 'Diagnóstico da equipe em 4 a 8 linhas, em português, direto e concreto.' },
    nota_equipe: { type: 'integer', description: 'Nota geral do atendimento da equipe, de 0 a 100.' },
    pontos_fortes: { ...listaStr, description: '3 a 6 pontos fortes da equipe como um todo, com exemplos.' },
    pontos_fracos: { ...listaStr, description: '3 a 6 pontos fracos recorrentes, com exemplos.' },
    o_que_falta: { ...listaStr, description: 'O que falta no atendimento ou no processo (perguntas, acompanhamento, registro, uso do padrão).' },
    prioridades: { ...listaStr, description: '3 a 5 ações prioritárias para o gestor nas próximas duas semanas, em ordem.' },
    por_corretor: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['corretor_id', 'nome', 'resumo', 'nota', 'pontos_fortes', 'pontos_fracos', 'recomendacoes'],
        properties: {
          corretor_id: { type: 'integer' },
          nome: str,
          resumo: { ...str, description: 'Parecer em 2 a 4 linhas. Se não há dados suficientes, diga isso.' },
          nota: { type: ['integer', 'null'], description: 'Nota de 0 a 100 do atendimento do corretor, ou null sem dados.' },
          pontos_fortes: listaStr,
          pontos_fracos: listaStr,
          recomendacoes: { ...listaStr, description: '1 a 3 recomendações práticas para este corretor.' },
        },
      },
    },
    clientes_em_risco: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cliente', 'corretor', 'motivo'],
        properties: { cliente: str, corretor: str, motivo: str },
      },
    },
  },
} as const

const SYSTEM_PAPEL = `Você é consultor de gestão comercial de imobiliárias e vai avaliar a EQUIPE de corretores da Nagamboa Imóveis (Garopaba e Praia da Gamboa, SC) para o gestor.

Você recebe números consolidados por corretor e as avaliações que a I.A. já fez de cada conversa (resumo, temperatura, estágio, nota do atendimento, pontos fortes e o que faltou perguntar). Baseie-se só nesses dados: não invente fatos, números nem clientes. Quando um corretor tem poucos dados, diga isso em vez de avaliar.

Regras do texto: português do Brasil, direto, concreto, citando nomes de corretores e clientes quando ajudar o gestor a agir. Nunca use travessão nem meia-risca; use ponto, vírgula ou dois-pontos. Fale do que o gestor pode fazer, não de generalidades.

Critérios de avaliação: aderência ao padrão de atendimento abaixo, qualificação do cliente (orçamento, prazo, finalidade, família, região), condução para a visita, acompanhamento (retorno prometido, lembretes), registro no CRM e tempo de resposta. Pontue a equipe de 0 a 100 de forma coerente com as notas individuais.`

function montarSystem(padrao: string): { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[] {
  return [
    { type: 'text', text: SYSTEM_PAPEL },
    { type: 'text', text: `PADRÃO DE ATENDIMENTO DA IMOBILIÁRIA:\n\n${padrao}`, cache_control: { type: 'ephemeral' } },
  ]
}

const corta = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}...` : s) : '')

// Texto compacto com tudo que a I.A. precisa, por corretor.
export function montarEntradaRelatorio(visao: VisaoEquipe): { texto: string; analisesConsideradas: number } {
  const linhas: string[] = []
  let consideradas = 0
  const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const t = visao.totais
  linhas.push(`EQUIPE (hoje ${data(visao.geradoEm)}): ${t.corretoresAtivos} corretor(es) ativo(s); ${t.clientes} clientes (${t.quentes} quentes, ${t.semAnalise} sem análise); ${t.analisesSemana} análises na semana e ${t.analises30} nos últimos ${DIAS_PERIODO} dias; nota média do atendimento ${t.notaAtendimento ?? 'sem dados'}; ${t.lembretesAtrasados} lembretes atrasados.`)
  linhas.push(`FUNIL: ${Object.entries(visao.funil).map(([e, n]) => `${ROTULO_ESTAGIO[e as keyof typeof ROTULO_ESTAGIO]} ${n}`).join(', ')}.`)
  if (visao.alertas.length) linhas.push(`ALERTAS: ${visao.alertas.map((a) => `${a.corretor}: ${a.texto}`).join(' | ')}`)

  for (const r of visao.porCorretor) {
    linhas.push('')
    linhas.push(`### ${r.corretor.nome} (id ${r.corretor.id}${r.corretor.ativo ? '' : ', desativado'}${r.corretor.papel === 'gestor' ? ', gestor' : ''})`)
    linhas.push(`Clientes ${r.clientes} (quentes ${r.quentes}, sem análise ${r.semAnalise}, quentes parados ${r.quentesParados}); análises ${r.analisesTotal} no total, ${r.analisesSemana} na semana, ${r.analises30} em ${DIAS_PERIODO} dias; nota média do atendimento ${r.notaAtendimento ?? 'sem dados'}; lembretes pendentes ${r.lembretesPendentes} (atrasados ${r.lembretesAtrasados}); última atividade ${r.ultimaAtividade ? data(r.ultimaAtividade) : 'nenhuma'}.`)
    const minhas = visao.analises.filter((a) => a.corretor_id === r.corretor.id).slice(0, MAX_ANALISES_POR_CORRETOR)
    if (!minhas.length) {
      linhas.push('Sem análises registradas.')
      continue
    }
    for (const a of minhas) {
      consideradas++
      const q = a.resultado.qualidade_atendimento
      linhas.push(`- ${data(a.criado_em)} ${a.cliente_nome}: ${ROTULO_TEMPERATURA[a.resultado.temperatura.nivel]} ${a.resultado.temperatura.nota}, ${ROTULO_ESTAGIO[a.resultado.estagio]}, atendimento ${q?.nota ?? '?'}/100. Resumo: ${corta(a.resultado.resumo, 320)} Pontos fortes: ${corta(q?.pontos_fortes?.join('; '), 300) || 'nenhum'}. Faltou perguntar: ${corta(q?.faltou_perguntar?.join('; '), 300) || 'nada'}. Observações: ${corta(q?.observacoes, 240) || 'nenhuma'}.`)
    }
  }
  return { texto: linhas.join('\n'), analisesConsideradas: consideradas }
}

function textos(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, max)
}

function nota(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function validarRelatorio(bruto: unknown): RelatorioEquipe {
  if (!bruto || typeof bruto !== 'object') throw new Error('Relatório vazio')
  const r = bruto as Record<string, unknown>
  if (typeof r.resumo_geral !== 'string' || !r.resumo_geral.trim()) throw new Error('Relatório sem resumo geral')
  const porCorretor = Array.isArray(r.por_corretor) ? r.por_corretor : []
  const risco = Array.isArray(r.clientes_em_risco) ? r.clientes_em_risco : []
  return {
    resumo_geral: r.resumo_geral.trim(),
    nota_equipe: nota(r.nota_equipe) ?? 0,
    pontos_fortes: textos(r.pontos_fortes),
    pontos_fracos: textos(r.pontos_fracos),
    o_que_falta: textos(r.o_que_falta),
    prioridades: textos(r.prioridades),
    por_corretor: porCorretor
      .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
      .map((p) => ({
        corretor_id: Number(p.corretor_id) || 0,
        nome: typeof p.nome === 'string' ? p.nome : `Corretor ${p.corretor_id}`,
        resumo: typeof p.resumo === 'string' ? p.resumo.trim() : '',
        nota: p.nota === null ? null : nota(p.nota),
        pontos_fortes: textos(p.pontos_fortes, 5),
        pontos_fracos: textos(p.pontos_fracos, 5),
        recomendacoes: textos(p.recomendacoes, 4),
      })),
    clientes_em_risco: risco
      .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
      .map((p) => ({ cliente: String(p.cliente ?? ''), corretor: String(p.corretor ?? ''), motivo: String(p.motivo ?? '') }))
      .filter((p) => p.cliente && p.motivo)
      .slice(0, 10),
  }
}

// Relatório de demonstração: montado a partir dos números reais da visão,
// para a tela mostrar algo útil mesmo sem a I.A.
export function relatorioDemo(visao: VisaoEquipe): RelatorioEquipe {
  const t = visao.totais
  const semDados = visao.porCorretor.filter((r) => r.analisesTotal === 0 && r.corretor.ativo)
  return {
    resumo_geral: `Demonstração (sem ANTHROPIC_API_KEY). A equipe tem ${t.corretoresAtivos} corretor(es) ativo(s), ${t.clientes} clientes na carteira, ${t.quentes} quentes, e fez ${t.analisesSemana} análise(s) na última semana. A nota média do atendimento nas análises é ${t.notaAtendimento ?? 'indisponível'}. ${semDados.length ? `${semDados.map((r) => r.corretor.nome).join(', ')} ainda não têm análises registradas, então não há como avaliar o atendimento deles.` : 'Todos os corretores ativos têm análises registradas.'} Com a chave da I.A. configurada, este relatório vira um diagnóstico escrito com base nas conversas.`,
    nota_equipe: t.notaAtendimento ?? 0,
    pontos_fortes: visao.pontosFortes.map((f) => `${f.texto} (${f.vezes}x)`),
    pontos_fracos: visao.faltou.map((f) => `Faltou perguntar: ${f.texto} (${f.vezes}x)`),
    o_que_falta: [
      ...(t.semAnalise ? [`${t.semAnalise} cliente(s) sem nenhuma análise: analisar as conversas para ter temperatura e próximos passos.`] : []),
      ...(t.lembretesAtrasados ? [`${t.lembretesAtrasados} lembrete(s) atrasado(s): retomar os retornos prometidos.`] : []),
      ...(semDados.length ? ['Corretores sem análises: começar a registrar as conversas no painel.'] : []),
    ],
    prioridades: visao.alertas.slice(0, 5).map((a) => `${a.corretor}: ${a.texto}`),
    por_corretor: visao.porCorretor.map((r) => ({
      corretor_id: r.corretor.id,
      nome: r.corretor.nome,
      resumo: r.analisesTotal
        ? `${r.clientes} cliente(s), ${r.quentes} quente(s), ${r.analisesTotal} análise(s). Nota média do atendimento ${r.notaAtendimento ?? 'indisponível'}.`
        : 'Sem análises registradas: não há dados para avaliar o atendimento.',
      nota: r.notaAtendimento,
      pontos_fortes: r.pontosFortes.slice(0, 3).map((f) => f.texto),
      pontos_fracos: r.faltou.slice(0, 3).map((f) => `Faltou perguntar: ${f.texto}`),
      recomendacoes: r.quentesParados ? [`Retomar contato com ${r.quentesParados} cliente(s) quente(s) parado(s).`] : r.analisesTotal ? [] : ['Registrar as conversas no painel para a I.A. avaliar.'],
    })),
    clientes_em_risco: visao.alertas.filter((a) => a.tipo === 'quente_parado').slice(0, 6).map((a) => ({ cliente: a.texto.split(' está ')[0], corretor: a.corretor, motivo: 'Quente e sem contato há mais de 3 dias' })),
  }
}

type RespostaAnthropic = {
  content?: { type: string; text?: string }[]
  stop_reason?: string
  stop_details?: { category?: string | null; explanation?: string } | null
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
  model?: string
}

export async function gerarRelatorioEquipe(visao: VisaoEquipe): Promise<RelatorioGuardado> {
  const { texto, analisesConsideradas } = montarEntradaRelatorio(visao)
  const apiKey = process.env.ANTHROPIC_API_KEY
  const base = { gerado_em: new Date().toISOString(), periodo_dias: DIAS_PERIODO, analises_consideradas: analisesConsideradas }
  if (!apiKey) return { ...base, relatorio: relatorioDemo(visao), modelo: 'demo', custo_usd: 0, demo: true }

  const modelo = modeloAnalise()
  const { texto: padrao } = await obterPadraoAtendimento()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2026-10-21' },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 12000,
      output_config: {
        effort: process.env.PAINEL_ANTHROPIC_EFFORT || 'medium',
        format: { type: 'json_schema', schema: RELATORIO_JSON_SCHEMA },
      },
      system: montarSystem(padrao),
      messages: [{ role: 'user', content: `Avalie a equipe com os dados abaixo e devolva o relatório no formato pedido. Inclua em por_corretor um item para CADA corretor listado, com o mesmo corretor_id.\n\n${texto}` }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 500)}`)
  const corpo = (await res.json()) as RespostaAnthropic
  if (corpo.stop_reason === 'refusal') throw new Error('A I.A. recusou gerar o relatório.')
  if (corpo.stop_reason === 'max_tokens') throw new Error('A resposta da I.A. foi cortada por tamanho.')
  const textoResposta = (corpo.content ?? []).filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('')
  const relatorio = validarRelatorio(extrairJson(textoResposta))
  const tokensEntrada = (corpo.usage?.input_tokens ?? 0) + (corpo.usage?.cache_read_input_tokens ?? 0) + (corpo.usage?.cache_creation_input_tokens ?? 0)
  const tokensSaida = corpo.usage?.output_tokens ?? 0
  return { ...base, relatorio, modelo: corpo.model ?? modelo, custo_usd: estimarCustoUsd(modelo, tokensEntrada, tokensSaida), demo: false }
}

export async function obterRelatorioGuardado(db: PainelDb): Promise<RelatorioGuardado | null> {
  const bruto = await db.obterConfig(CHAVE_RELATORIO)
  if (!bruto) return null
  try {
    const g = JSON.parse(bruto) as RelatorioGuardado
    return g?.relatorio?.resumo_geral ? g : null
  } catch {
    return null
  }
}

export async function salvarRelatorio(db: PainelDb, g: RelatorioGuardado): Promise<void> {
  await db.salvarConfig(CHAVE_RELATORIO, JSON.stringify(g))
}
