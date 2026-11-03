// Esquema JSON da análise estruturada e validador/normalizador do resultado.
//
// O mesmo esquema é enviado à API da Anthropic (output_config.format, tipo
// json_schema) e usado aqui para validar o que volta. A API garante a forma,
// mas não limites numéricos nem datas válidas: isso é tratado em
// validarAnalise(), que também aceita entradas levemente fora do padrão
// (ex.: nota como string) para o histórico nunca ficar com lixo.

import type { AnaliseResultado, Confianca, Estagio, Temperatura, TipoInsight } from './tipos'
import { ESTAGIOS, TEMPERATURAS } from './tipos'

const TIPOS_INSIGHT: TipoInsight[] = ['urgencia', 'hesitacao', 'concorrencia', 'decisor_ausente', 'risco_perda', 'oportunidade', 'outro']
const CONFIANCAS: Confianca[] = ['alta', 'media', 'baixa']

const str = { type: 'string' } as const
const strOuNulo = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const
const listaStr = { type: 'array', items: { type: 'string' } } as const

// JSON Schema compatível com as restrições de "structured outputs" da API:
// todos os objetos com additionalProperties: false e required completo; sem
// minimum/maximum (validados no cliente).
export const ANALISE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'resumo',
    'temperatura',
    'estagio',
    'fatos',
    'insights',
    'proxima_mensagem',
    'texto_jetimob',
    'lembretes',
    'perguntas_abertas',
    'proximos_passos',
    'qualidade_atendimento',
  ],
  properties: {
    resumo: { ...str, description: 'Resumo executivo da conversa em 3 a 5 linhas, em português.' },
    temperatura: {
      type: 'object',
      additionalProperties: false,
      required: ['nivel', 'nota', 'justificativa'],
      properties: {
        nivel: { type: 'string', enum: TEMPERATURAS },
        nota: { type: 'integer', description: 'Nota de 0 a 100 coerente com o nível.' },
        justificativa: str,
      },
    },
    estagio: { type: 'string', enum: ESTAGIOS },
    fatos: {
      type: 'object',
      additionalProperties: false,
      required: [
        'orcamento',
        'forma_pagamento',
        'prazo',
        'composicao_familiar',
        'regiao_desejada',
        'tipo_imovel',
        'imoveis_citados',
        'objecoes',
        'preferencias',
        'contato',
      ],
      properties: {
        orcamento: strOuNulo,
        forma_pagamento: { ...strOuNulo, description: 'financiamento, à vista, FGTS, permuta, consórcio etc.' },
        prazo: strOuNulo,
        composicao_familiar: strOuNulo,
        regiao_desejada: strOuNulo,
        tipo_imovel: strOuNulo,
        imoveis_citados: { ...listaStr, description: 'Códigos de imóveis citados (ex.: T0624), sem repetição.' },
        objecoes: listaStr,
        preferencias: listaStr,
        contato: {
          type: 'object',
          additionalProperties: false,
          required: ['nome', 'telefone', 'email'],
          properties: { nome: strOuNulo, telefone: strOuNulo, email: strOuNulo },
        },
      },
    },
    insights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'descricao'],
        properties: { tipo: { type: 'string', enum: TIPOS_INSIGHT }, descricao: str },
      },
    },
    proxima_mensagem: {
      type: 'object',
      additionalProperties: false,
      required: ['curta', 'longa'],
      properties: {
        curta: { ...str, description: 'Mensagem de WhatsApp curta (1 a 2 frases), pronta para enviar.' },
        longa: { ...str, description: 'Versão mais completa (3 a 6 frases), pronta para enviar.' },
      },
    },
    texto_jetimob: { ...str, description: 'Nota objetiva e padronizada para colar no histórico do lead no Jetimob.' },
    lembretes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'data', 'trecho', 'confianca'],
        properties: {
          titulo: str,
          data: { ...str, description: 'Data absoluta ISO 8601 (AAAA-MM-DD ou AAAA-MM-DDTHH:MM) calculada a partir da data da conversa.' },
          trecho: { ...str, description: 'Trecho literal da conversa que originou o lembrete.' },
          confianca: { type: 'string', enum: CONFIANCAS },
        },
      },
    },
    perguntas_abertas: listaStr,
    proximos_passos: listaStr,
    qualidade_atendimento: {
      type: 'object',
      additionalProperties: false,
      required: ['nota', 'pontos_fortes', 'faltou_perguntar', 'observacoes'],
      properties: {
        nota: { type: 'integer', description: 'Nota de 0 a 100 do atendimento do corretor.' },
        pontos_fortes: listaStr,
        faltou_perguntar: listaStr,
        observacoes: str,
      },
    },
  },
} as const

export class ErroAnaliseInvalida extends Error {
  readonly problemas: string[]
  constructor(problemas: string[]) {
    super(`Análise inválida: ${problemas.join('; ')}`)
    this.name = 'ErroAnaliseInvalida'
    this.problemas = problemas
  }
}

type Obj = Record<string, unknown>

const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function texto(v: unknown, campo: string, problemas: string[], obrigatorio = true): string {
  if (typeof v === 'string') return v.trim()
  if (v === null || v === undefined) {
    if (obrigatorio) problemas.push(`${campo} ausente`)
    return ''
  }
  return String(v)
}

function textoOuNulo(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim())).filter(Boolean)
}

function nota(v: unknown, campo: string, problemas: string[]): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
  if (!Number.isFinite(n)) {
    problemas.push(`${campo} não é número`)
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(n)))
}

function enumValor<T extends string>(v: unknown, opcoes: readonly T[], campo: string, problemas: string[], padrao: T): T {
  if (typeof v === 'string' && (opcoes as readonly string[]).includes(v)) return v as T
  problemas.push(`${campo} fora das opções (${String(v)})`)
  return padrao
}

// Coerência entre nível e nota: a nota manda, o nível é ajustado se divergir.
export function nivelPelaNota(n: number): Temperatura {
  if (n >= 85) return 'muito_quente'
  if (n >= 60) return 'quente'
  if (n >= 30) return 'morno'
  return 'frio'
}

// Normaliza datas vindas da I.A.: aceita AAAA-MM-DD, AAAA-MM-DDTHH:MM(:SS) e
// DD/MM/AAAA[ HH:MM]. Devolve ISO sem fuso (hora local do corretor) ou null.
export function normalizarDataLembrete(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?/)
  if (m) {
    const [, a, me, d, h, mi] = m
    return montarIso(Number(a), Number(me), Number(d), h ? Number(h) : null, mi ? Number(mi) : null)
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?/)
  if (m) {
    const [, d, me, a, h, mi] = m
    return montarIso(Number(a), Number(me), Number(d), h ? Number(h) : null, mi ? Number(mi) : null)
  }
  return null
}

function montarIso(a: number, m: number, d: number, h: number | null, mi: number | null): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(a, m - 1, d))
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  const p = (n: number) => String(n).padStart(2, '0')
  const base = `${a}-${p(m)}-${p(d)}`
  if (h === null || mi === null || h > 23 || mi > 59) return base
  return `${base}T${p(h)}:${p(mi)}`
}

// Valida e normaliza o JSON devolvido pela I.A. Lança ErroAnaliseInvalida
// quando faltam campos essenciais; problemas menores são corrigidos e
// devolvidos em `avisos`.
export function validarAnalise(bruto: unknown): { analise: AnaliseResultado; avisos: string[] } {
  if (!ehObj(bruto)) throw new ErroAnaliseInvalida(['resposta não é um objeto'])
  const problemas: string[] = []
  const avisos: string[] = []

  const resumo = texto(bruto.resumo, 'resumo', problemas)

  const temp = ehObj(bruto.temperatura) ? bruto.temperatura : {}
  if (!ehObj(bruto.temperatura)) problemas.push('temperatura ausente')
  const notaTemp = nota(temp.nota, 'temperatura.nota', problemas)
  let nivel = enumValor(temp.nivel, TEMPERATURAS, 'temperatura.nivel', avisos, nivelPelaNota(notaTemp))
  if (nivel !== nivelPelaNota(notaTemp)) {
    avisos.push(`temperatura.nivel (${nivel}) ajustado pela nota ${notaTemp}`)
    nivel = nivelPelaNota(notaTemp)
  }

  const estagio = enumValor<Estagio>(bruto.estagio, ESTAGIOS, 'estagio', avisos, 'qualificacao')

  const f = ehObj(bruto.fatos) ? bruto.fatos : {}
  if (!ehObj(bruto.fatos)) problemas.push('fatos ausente')
  const contato = ehObj(f.contato) ? f.contato : {}
  const fatos: AnaliseResultado['fatos'] = {
    orcamento: textoOuNulo(f.orcamento),
    forma_pagamento: textoOuNulo(f.forma_pagamento),
    prazo: textoOuNulo(f.prazo),
    composicao_familiar: textoOuNulo(f.composicao_familiar),
    regiao_desejada: textoOuNulo(f.regiao_desejada),
    tipo_imovel: textoOuNulo(f.tipo_imovel),
    imoveis_citados: Array.from(new Set(lista(f.imoveis_citados).map((c) => c.toUpperCase()))),
    objecoes: lista(f.objecoes),
    preferencias: lista(f.preferencias),
    contato: { nome: textoOuNulo(contato.nome), telefone: textoOuNulo(contato.telefone), email: textoOuNulo(contato.email) },
  }

  const insights: AnaliseResultado['insights'] = Array.isArray(bruto.insights)
    ? bruto.insights
        .filter(ehObj)
        .map((i) => ({
          tipo: enumValor<TipoInsight>(i.tipo, TIPOS_INSIGHT, 'insights.tipo', avisos, 'outro'),
          descricao: texto(i.descricao, 'insights.descricao', avisos, false),
        }))
        .filter((i) => i.descricao)
    : []

  const pm = ehObj(bruto.proxima_mensagem) ? bruto.proxima_mensagem : {}
  if (!ehObj(bruto.proxima_mensagem)) problemas.push('proxima_mensagem ausente')
  const proxima_mensagem = {
    curta: texto(pm.curta, 'proxima_mensagem.curta', problemas),
    longa: texto(pm.longa, 'proxima_mensagem.longa', avisos, false) || texto(pm.curta, 'proxima_mensagem.curta', [], false),
  }

  const texto_jetimob = texto(bruto.texto_jetimob, 'texto_jetimob', problemas)

  const lembretes: AnaliseResultado['lembretes'] = Array.isArray(bruto.lembretes)
    ? bruto.lembretes
        .filter(ehObj)
        .flatMap((l) => {
          const data = normalizarDataLembrete(l.data)
          const titulo = texto(l.titulo, 'lembretes.titulo', avisos, false)
          if (!data || !titulo) {
            avisos.push(`lembrete descartado (data ou título inválidos): ${String(l.titulo ?? '')} / ${String(l.data ?? '')}`)
            return []
          }
          return [
            {
              titulo,
              data,
              trecho: texto(l.trecho, 'lembretes.trecho', avisos, false),
              confianca: enumValor<Confianca>(l.confianca, CONFIANCAS, 'lembretes.confianca', avisos, 'media'),
            },
          ]
        })
    : []

  const qa = ehObj(bruto.qualidade_atendimento) ? bruto.qualidade_atendimento : {}
  if (!ehObj(bruto.qualidade_atendimento)) problemas.push('qualidade_atendimento ausente')
  const qualidade_atendimento = {
    nota: nota(qa.nota, 'qualidade_atendimento.nota', problemas),
    pontos_fortes: lista(qa.pontos_fortes),
    faltou_perguntar: lista(qa.faltou_perguntar),
    observacoes: texto(qa.observacoes, 'qualidade_atendimento.observacoes', avisos, false),
  }

  if (problemas.length) throw new ErroAnaliseInvalida(problemas)

  return {
    analise: {
      resumo,
      temperatura: { nivel, nota: notaTemp, justificativa: texto(temp.justificativa, 'temperatura.justificativa', avisos, false) },
      estagio,
      fatos,
      insights,
      proxima_mensagem,
      texto_jetimob,
      lembretes,
      perguntas_abertas: lista(bruto.perguntas_abertas),
      proximos_passos: lista(bruto.proximos_passos),
      qualidade_atendimento,
    },
    avisos,
  }
}

// Extrai o primeiro objeto JSON de um texto (tolerante a cercas de código),
// para o caso de a resposta não vir como JSON puro.
export function extrairJson(textoBruto: string): unknown {
  const t = textoBruto.trim()
  try {
    return JSON.parse(t)
  } catch {
    // segue para a busca do primeiro {...}
  }
  const ini = t.indexOf('{')
  const fim = t.lastIndexOf('}')
  if (ini === -1 || fim <= ini) throw new ErroAnaliseInvalida(['resposta sem JSON'])
  try {
    return JSON.parse(t.slice(ini, fim + 1))
  } catch {
    throw new ErroAnaliseInvalida(['JSON malformado'])
  }
}
