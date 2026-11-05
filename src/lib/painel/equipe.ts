// Visão da equipe para o gestor: números por corretor, funil consolidado,
// pontos fortes e lacunas recorrentes (vindos da qualidade_atendimento que a
// I.A. já avalia em cada análise) e alertas. Tudo calculado a partir dos
// dados que o painel já guarda; nada de chamada à I.A. aqui.

import type { PainelDb } from './db'
import type { Analise, Cliente, Corretor, Estagio } from './tipos'
import { ESTAGIOS } from './tipos'
import { classificarLembrete } from './formato'

const DIA = 86_400_000

export type Frequencia = { texto: string; vezes: number }

export type ResumoCorretor = {
  corretor: Corretor
  clientes: number
  quentes: number
  semAnalise: number
  quentesParados: number // quentes sem interação há mais de 3 dias
  analisesTotal: number
  analisesSemana: number
  analises30: number
  notaAtendimento: number | null // média da qualidade do atendimento (0 a 100)
  notaTemperatura: number | null // média da nota de temperatura dos clientes
  lembretesPendentes: number
  lembretesAtrasados: number
  lembretesHoje: number
  ultimaAtividade: string | null
  funil: Record<Estagio, number>
  pontosFortes: Frequencia[]
  faltou: Frequencia[]
}

export type AlertaEquipe = {
  tipo: 'quente_parado' | 'lembrete_atrasado' | 'sem_analise' | 'sem_atividade'
  texto: string
  corretor: string
  cliente_id?: string
}

export type VisaoEquipe = {
  geradoEm: string
  totais: {
    corretores: number
    corretoresAtivos: number
    clientes: number
    quentes: number
    semAnalise: number
    analisesTotal: number
    analisesSemana: number
    analises30: number
    notaAtendimento: number | null
    lembretesAtrasados: number
    lembretesHoje: number
    custo30Usd: number
  }
  funil: Record<Estagio, number>
  porCorretor: ResumoCorretor[]
  pontosFortes: Frequencia[]
  faltou: Frequencia[]
  alertas: AlertaEquipe[]
  clientes: (Cliente & { corretor_nome: string })[]
  analises: (Analise & { cliente_nome: string; corretor_nome: string })[]
}

function chave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Agrupa frases parecidas (mesmo texto sem acento/pontuação) e devolve as
// mais repetidas. Serve para "pontos fortes recorrentes" e "o que mais falta".
export function frequencias(listas: (string[] | undefined)[], top = 6): Frequencia[] {
  const mapa = new Map<string, Frequencia>()
  for (const lista of listas) {
    for (const item of lista ?? []) {
      const k = chave(item)
      if (!k) continue
      const f = mapa.get(k)
      if (f) f.vezes++
      else mapa.set(k, { texto: item.trim(), vezes: 1 })
    }
  }
  return [...mapa.values()].sort((a, b) => b.vezes - a.vezes || a.texto.localeCompare(b.texto, 'pt-BR')).slice(0, top)
}

function media(ns: number[]): number | null {
  if (!ns.length) return null
  return Math.round(ns.reduce((a, b) => a + b, 0) / ns.length)
}

function funilVazio(): Record<Estagio, number> {
  return Object.fromEntries(ESTAGIOS.map((e) => [e, 0])) as Record<Estagio, number>
}

// Corretor que só aparece nos dados (sem linha na tabela corretores).
function sintetico(id: number): Corretor {
  const agora = new Date(0).toISOString()
  return { id, usuario: `#${id}`, nome: `Corretor #${id}`, email: null, papel: 'corretor', jetimob_id: null, ativo: true, tem_senha: false, criado_em: agora, atualizado_em: agora }
}

const ehQuente = (c: Cliente) => c.temperatura === 'quente' || c.temperatura === 'muito_quente'

export async function montarVisaoEquipe(db: PainelDb, agora = new Date()): Promise<VisaoEquipe> {
  const [corretores, clientes, analises, pendentes] = await Promise.all([
    db.listarCorretores().catch(() => [] as Corretor[]),
    db.listarClientes(),
    db.listarAnalisesRecentes(null, 1000),
    db.listarLembretes({ status: 'pendente' }),
  ])

  const porId = new Map(corretores.map((c) => [c.id, c]))
  for (const id of new Set([...clientes.map((c) => c.corretor_id), ...analises.map((a) => a.corretor_id)])) {
    if (!porId.has(id)) porId.set(id, sintetico(id))
  }

  const semanaIso = new Date(agora.getTime() - 7 * DIA).toISOString()
  const mesIso = new Date(agora.getTime() - 30 * DIA).toISOString()
  const tresDias = agora.getTime() - 3 * DIA
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]))
  const nomeCorretor = (id: number) => porId.get(id)?.nome ?? `Corretor #${id}`

  const alertas: AlertaEquipe[] = []

  const porCorretor: ResumoCorretor[] = [...porId.values()].map((corretor) => {
    const meus = clientes.filter((c) => c.corretor_id === corretor.id)
    const minhas = analises.filter((a) => a.corretor_id === corretor.id)
    const meusLembretes = pendentes.filter((l) => l.corretor_id === corretor.id)
    const no30 = minhas.filter((a) => a.criado_em >= mesIso)
    const baseQualidade = no30.length >= 3 ? no30 : minhas
    const funil = funilVazio()
    for (const c of meus) if (c.estagio) funil[c.estagio]++
    const quentesParados = meus.filter((c) => ehQuente(c) && (!c.ultima_interacao || Date.parse(c.ultima_interacao) < tresDias))
    const atrasados = meusLembretes.filter((l) => classificarLembrete(l.data) === 'atrasado')
    const hoje = meusLembretes.filter((l) => classificarLembrete(l.data) === 'hoje')
    const semAnalise = meus.filter((c) => !c.temperatura)
    const datas = [...minhas.map((a) => a.criado_em), ...meus.map((c) => c.ultima_interacao ?? '')].filter(Boolean).sort()
    const ultimaAtividade = datas.at(-1) ?? null

    for (const c of quentesParados.slice(0, 3)) {
      alertas.push({ tipo: 'quente_parado', corretor: corretor.nome, cliente_id: c.id, texto: `${c.nome} está ${c.temperatura === 'muito_quente' ? 'muito quente' : 'quente'} e sem contato há mais de 3 dias` })
    }
    if (atrasados.length) alertas.push({ tipo: 'lembrete_atrasado', corretor: corretor.nome, texto: `${atrasados.length} lembrete(s) atrasado(s)` })
    if (semAnalise.length) alertas.push({ tipo: 'sem_analise', corretor: corretor.nome, texto: `${semAnalise.length} cliente(s) sem nenhuma análise` })
    if (corretor.ativo && meus.length && (!ultimaAtividade || ultimaAtividade < semanaIso)) {
      alertas.push({ tipo: 'sem_atividade', corretor: corretor.nome, texto: 'Sem análise nem interação registrada nos últimos 7 dias' })
    }

    return {
      corretor,
      clientes: meus.length,
      quentes: meus.filter(ehQuente).length,
      semAnalise: semAnalise.length,
      quentesParados: quentesParados.length,
      analisesTotal: minhas.length,
      analisesSemana: minhas.filter((a) => a.criado_em >= semanaIso).length,
      analises30: no30.length,
      notaAtendimento: media(baseQualidade.map((a) => a.resultado.qualidade_atendimento?.nota).filter((n): n is number => typeof n === 'number')),
      notaTemperatura: media(meus.map((c) => c.nota_temperatura).filter((n): n is number => typeof n === 'number')),
      lembretesPendentes: meusLembretes.length,
      lembretesAtrasados: atrasados.length,
      lembretesHoje: hoje.length,
      ultimaAtividade,
      funil,
      pontosFortes: frequencias(baseQualidade.map((a) => a.resultado.qualidade_atendimento?.pontos_fortes)),
      faltou: frequencias(baseQualidade.map((a) => a.resultado.qualidade_atendimento?.faltou_perguntar)),
    }
  })

  // ativos com carteira primeiro; depois por número de clientes e nome
  porCorretor.sort((a, b) => Number(b.corretor.ativo) - Number(a.corretor.ativo) || b.clientes - a.clientes || a.corretor.nome.localeCompare(b.corretor.nome, 'pt-BR'))

  const funil = funilVazio()
  for (const c of clientes) if (c.estagio) funil[c.estagio]++
  const no30 = analises.filter((a) => a.criado_em >= mesIso)
  const baseQualidade = no30.length >= 3 ? no30 : analises

  const pesoAlerta: Record<AlertaEquipe['tipo'], number> = { quente_parado: 0, lembrete_atrasado: 1, sem_atividade: 2, sem_analise: 3 }
  alertas.sort((a, b) => pesoAlerta[a.tipo] - pesoAlerta[b.tipo])

  return {
    geradoEm: agora.toISOString(),
    totais: {
      corretores: porId.size,
      corretoresAtivos: [...porId.values()].filter((c) => c.ativo).length,
      clientes: clientes.length,
      quentes: clientes.filter(ehQuente).length,
      semAnalise: clientes.filter((c) => !c.temperatura).length,
      analisesTotal: analises.length,
      analisesSemana: analises.filter((a) => a.criado_em >= semanaIso).length,
      analises30: no30.length,
      notaAtendimento: media(baseQualidade.map((a) => a.resultado.qualidade_atendimento?.nota).filter((n): n is number => typeof n === 'number')),
      lembretesAtrasados: pendentes.filter((l) => classificarLembrete(l.data) === 'atrasado').length,
      lembretesHoje: pendentes.filter((l) => classificarLembrete(l.data) === 'hoje').length,
      custo30Usd: no30.reduce((s, a) => s + (a.custo_usd || 0), 0),
    },
    funil,
    porCorretor,
    pontosFortes: frequencias(baseQualidade.map((a) => a.resultado.qualidade_atendimento?.pontos_fortes)),
    faltou: frequencias(baseQualidade.map((a) => a.resultado.qualidade_atendimento?.faltou_perguntar)),
    alertas: alertas.slice(0, 12),
    clientes: clientes.map((c) => ({ ...c, corretor_nome: nomeCorretor(c.corretor_id) })),
    analises: analises.slice(0, 60).map((a) => ({ ...a, cliente_nome: nomeCliente.get(a.cliente_id) ?? 'Cliente', corretor_nome: nomeCorretor(a.corretor_id) })),
  }
}
