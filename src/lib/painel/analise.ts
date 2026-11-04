// Análise de conversa com Claude: monta o system prompt (papel + padrão de
// atendimento), envia a conversa com saída estruturada (JSON Schema) e
// valida o resultado. Sem ANTHROPIC_API_KEY devolve o exemplo fixo (demo).
//
// Segue o padrão do site (src/app/api/chat/route.ts): chamada direta à API
// com fetch, sem SDK, para não adicionar dependência.

import { ANALISE_JSON_SCHEMA, extrairJson, validarAnalise } from './analise-schema'
import type { ImagemEnviada } from './extrair-conteudo'
import { ANALISE_DEMO } from './demo'
import { obterPadraoAtendimento } from './padrao-atendimento'
import type { AnaliseResultado, TipoCliente } from './tipos'
import { ROTULO_TIPO_CLIENTE } from './tipos'

export const MODELO_PADRAO = 'claude-sonnet-5-5'

export function modeloAnalise(): string {
  return process.env.PAINEL_ANTHROPIC_MODEL || MODELO_PADRAO
}

// Preço por milhão de tokens (USD) para estimar o custo de cada análise.
// Fonte: tabela de modelos da Anthropic (outubro de 2026). Modelos fora da
// tabela usam o preço do Sonnet como aproximação.
const PRECOS_USD_POR_MTOK: Record<string, { entrada: number; saida: number }> = {
  'claude-fable-5-1': { entrada: 10, saida: 50 },
  'claude-opus-5-5': { entrada: 4, saida: 20 },
  'claude-opus-5': { entrada: 5, saida: 25 },
  'claude-opus-4-8': { entrada: 5, saida: 25 },
  'claude-sonnet-5-5': { entrada: 2, saida: 10 },
  'claude-sonnet-5': { entrada: 2, saida: 10 },
  'claude-sonnet-4-6': { entrada: 3, saida: 15 },
  'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 },
  'claude-haiku-4-5': { entrada: 1, saida: 5 },
}

export function estimarCustoUsd(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const chave = Object.keys(PRECOS_USD_POR_MTOK).find((k) => modelo.startsWith(k))
  const preco = chave ? PRECOS_USD_POR_MTOK[chave] : PRECOS_USD_POR_MTOK['claude-sonnet-5-5']
  return (tokensEntrada * preco.entrada + tokensSaida * preco.saida) / 1_000_000
}

// O que o painel já sabe do cliente, de conversas e análises anteriores.
export type HistoricoCliente = {
  tipoRegistrado: TipoCliente
  tipoFixadoManualmente: boolean
  avaliacaoAnterior: string | null // ex.: "Quente (72/100), estágio visita agendada, em 2026-11-04"
  resumoAnterior: string | null
  fatosAnteriores: string[]
  conversasAnteriores: string[] // mais recentes primeiro, já limitadas em tamanho
  totalAnalises: number
}

export type EntradaAnalise = {
  conversa: string
  historico?: HistoricoCliente | null
  // prints da conversa, lidos pela visão do modelo; podem vir sozinhos
  imagens?: ImagemEnviada[]
  dataConversa: string // AAAA-MM-DD
  corretorNome: string
  clienteNome?: string | null
  clienteTelefone?: string | null
  codigoImovel?: string | null
  tipoCliente?: TipoCliente | null
}

export type SaidaAnalise = {
  resultado: AnaliseResultado
  modelo: string
  tokensEntrada: number
  tokensSaida: number
  custoUsd: number
  demo: boolean
  avisos: string[]
}

const PAPEL = `Você é a inteligência de apoio ao corretor do Painel do Corretor da Nagamboa Imóveis (Garopaba, SC). Sua função é ler a transcrição ou o resumo de uma conversa entre o corretor e um cliente (comprador, locatário ou proprietário) e devolver uma análise estruturada, objetiva e útil, seguindo o PADRÃO DE ATENDIMENTO da imobiliária abaixo.

Regras gerais:
- Baseie-se SOMENTE no que está na conversa e nos dados informados. Não invente fatos, valores, nomes ou datas. Quando algo não aparece, use null ou lista vazia.
- Temperatura: aplique os critérios do padrão de atendimento. A nota (0 a 100) deve ser coerente com o nível (frio 0 a 29, morno 30 a 59, quente 60 a 84, muito quente 85 a 100).
- Lembretes: converta TODA tarefa, compromisso ou promessa com referência temporal ("me liga sexta", "mando o contrato dia 5", "visita domingo às 15h", "te retorno amanhã") em data absoluta ISO 8601 a partir da DATA DA CONVERSA informada. Se a hora não for dita, use um horário comercial razoável (09:00 para tarefas do corretor, 18:00 para prazos de fim de dia). Marque a confiança como baixa quando a referência for vaga ("semana que vem"). Inclua o trecho literal que originou cada lembrete.
- Códigos de imóveis seguem o formato letra + números (ex.: C0412, T0624, A0231). Liste os citados sem repetição.
- Sugestões de mensagem: tom do padrão de atendimento, português natural de WhatsApp, primeira pessoa como o corretor, sem travessão (—) nem meia-risca (–), sem promessas que o corretor não fez. A versão curta tem 1 a 2 frases; a longa, 3 a 6 frases. Devem estar prontas para copiar e enviar.
- Texto para o Jetimob: siga a ordem da seção "Padrão de registro no Jetimob" do padrão de atendimento, em um único parágrafo objetivo.
- Qualidade do atendimento: avalie o CORRETOR (não o cliente) contra as perguntas de qualificação obrigatórias e as regras do padrão. Seja direto sobre o que faltou perguntar.
- Insights: aponte sinais que uma pessoa ocupada deixaria passar (urgência, hesitação, concorrência, decisor ausente, risco de perda, oportunidade). Cada insight em uma frase ou duas, com o que fazer a respeito.
- Tipo de cliente (campo tipo_cliente): classifique pelo que a pessoa quer fazer, não por palavras soltas. Quem pergunta preço de venda, financiamento, entrada ou quer visitar para comprar é comprador, mesmo que a palavra "alugar" apareça em outro contexto. Quem procura casa para temporada ou aluguel anual é locatário. Quem quer vender ou alugar um imóvel dele é proprietário. Use indefinido só se a conversa não permitir saber.
- Nunca use travessão (—) ou meia-risca (–) em nenhum texto. Escreva tudo em português do Brasil.

QUANDO HOUVER UM BLOCO "HISTÓRICO JÁ CONHECIDO DESTE CLIENTE":
- Ele traz o que o painel já sabe de conversas anteriores. A conversa nova pode ser continuação, pode repetir mensagens já vistas, ou ser só um trecho curto.
- Avalie o cliente como um todo: temperatura, estágio, tipo e fatos devem refletir tudo que se sabe, não apenas o trecho novo. Um trecho curto ou uma mensagem solta não rebaixam a temperatura por si só; só rebaixe se houver sinal real de esfriamento (desinteresse, prazo perdido, silêncio prolongado, desistência).
- Se o trecho novo contradisser o histórico (desistência, mudança de orçamento, outro imóvel), prevaleça o mais recente e diga isso na justificativa da temperatura.
- Se o histórico disser que o tipo foi fixado manualmente pelo corretor, mantenha esse tipo.
- Em lembretes, inclua só compromissos novos ou ainda pendentes; não recrie os já cumpridos.
- No resumo, integre: o que já se sabia mais o que mudou agora.

QUANDO A CONVERSA VIER COMO IMAGEM (prints de tela):
- Leia os prints na ordem em que aparecem; costumam ser partes seguidas da mesma conversa, e pode haver repetição de mensagens entre um e outro.
- Preencha o campo transcricao com o diálogo que leu, uma mensagem por linha, no formato "[data hora] Quem: texto" quando data e hora estiverem visíveis, ou "Quem: texto" quando não estiverem. No WhatsApp, as mensagens alinhadas à direita são do corretor e as da esquerda são do cliente.
- Não invente trecho ilegível: escreva [ilegível] no lugar.
- Se os prints não contiverem conversa nenhuma, diga isso no resumo em vez de inventar uma análise.
- Quando a conversa vier como texto, devolva transcricao como null.`

function montarSystem(padrao: string): { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[] {
  return [
    { type: 'text', text: PAPEL },
    { type: 'text', text: `PADRÃO DE ATENDIMENTO DA IMOBILIÁRIA:\n\n${padrao}`, cache_control: { type: 'ephemeral' } },
  ]
}

type BlocoConteudo =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

function montarConteudoUsuario(e: EntradaAnalise): BlocoConteudo[] {
  const imagens = e.imagens ?? []
  // as imagens vêm antes do texto: o modelo lê os prints e depois a instrução
  const blocos: BlocoConteudo[] = imagens.map((i) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: i.media_type, data: i.data },
  }))
  blocos.push({ type: 'text', text: montarMensagemUsuario(e) })
  return blocos
}

function montarMensagemUsuario(e: EntradaAnalise): string {
  const imagens = e.imagens ?? []
  const linhas = [
    `DATA DA CONVERSA (referência para datas relativas): ${e.dataConversa}`,
    `CORRETOR: ${e.corretorNome}`,
    `CLIENTE INFORMADO PELO CORRETOR: ${e.clienteNome?.trim() || 'não informado'}`,
    `TELEFONE INFORMADO: ${e.clienteTelefone?.trim() || 'não informado'}`,
    `CÓDIGO DO IMÓVEL INFORMADO: ${e.codigoImovel?.trim() || 'não informado'}`,
    `TIPO DE CLIENTE INFORMADO: ${e.tipoCliente && e.tipoCliente !== 'indefinido' ? ROTULO_TIPO_CLIENTE[e.tipoCliente] : 'não informado (deduza pela conversa e pelo histórico)'}`,
    '',
  ]
  const h = e.historico
  if (h) {
    linhas.push(
      `HISTÓRICO JÁ CONHECIDO DESTE CLIENTE (${h.totalAnalises} análise(s) anterior(es) no painel):`,
      `- Tipo registrado: ${ROTULO_TIPO_CLIENTE[h.tipoRegistrado]}${h.tipoFixadoManualmente ? ' (fixado manualmente pelo corretor; mantenha)' : ' (deduzido pela I.A.; pode revisar)'}`,
      `- Última avaliação: ${h.avaliacaoAnterior ?? 'nenhuma'}`,
      `- Resumo anterior: ${h.resumoAnterior ?? 'nenhum'}`
    )
    if (h.fatosAnteriores.length) linhas.push('- Fatos já levantados:', ...h.fatosAnteriores.map((f) => `  · ${f}`))
    if (h.conversasAnteriores.length) {
      linhas.push(
        `- Conversas anteriores (${h.conversasAnteriores.length}, mais recentes primeiro; podem se sobrepor à conversa nova):`,
        '"""',
        h.conversasAnteriores.join('\n\n'),
        '"""'
      )
    }
    linhas.push('')
  }
  if (imagens.length) {
    linhas.push(
      `CONVERSA: ${imagens.length === 1 ? 'o print acima' : `os ${imagens.length} prints acima, em ordem`}.`,
      'Transcreva o diálogo no campo transcricao e analise a partir dele.'
    )
  }
  if (e.conversa.trim()) {
    linhas.push(
      imagens.length ? 'TEXTO ADICIONAL ENVIADO PELO CORRETOR:' : h ? 'CONVERSA NOVA (a avaliar junto com o histórico):' : 'CONVERSA:',
      '"""',
      e.conversa.trim(),
      '"""'
    )
  }
  linhas.push('', 'Devolva a análise no formato JSON exigido.')
  return linhas.join('\n')
}

export function analiseDemo(e: EntradaAnalise): SaidaAnalise {
  const resultado: AnaliseResultado = JSON.parse(JSON.stringify(ANALISE_DEMO))
  if (e.clienteNome?.trim()) resultado.fatos.contato.nome = e.clienteNome.trim()
  if (e.clienteTelefone?.trim()) resultado.fatos.contato.telefone = e.clienteTelefone.trim()
  if (e.tipoCliente && e.tipoCliente !== 'indefinido') resultado.tipo_cliente = e.tipoCliente
  return { resultado, modelo: 'demo', tokensEntrada: 0, tokensSaida: 0, custoUsd: 0, demo: true, avisos: [] }
}

export function iaDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

type RespostaAnthropic = {
  content?: { type: string; text?: string }[]
  stop_reason?: string
  stop_details?: { category?: string | null; explanation?: string } | null
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
  model?: string
}

export async function analisarConversa(e: EntradaAnalise): Promise<SaidaAnalise> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return analiseDemo(e)

  const modelo = modeloAnalise()
  const { texto: padrao } = await obterPadraoAtendimento()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2026-10-21',
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 16000,
      // esforço médio: análise rápida o suficiente para caber no tempo da
      // função serverless, com raciocínio adaptativo ligado (padrão do modelo)
      output_config: {
        effort: process.env.PAINEL_ANTHROPIC_EFFORT || 'medium',
        format: { type: 'json_schema', schema: ANALISE_JSON_SCHEMA },
      },
      system: montarSystem(padrao),
      messages: [{ role: 'user', content: montarConteudoUsuario(e) }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 500)}`)
  }
  const corpo = (await res.json()) as RespostaAnthropic

  if (corpo.stop_reason === 'refusal') {
    throw new Error(`A I.A. recusou analisar esta conversa (${corpo.stop_details?.category ?? 'sem categoria'}).`)
  }
  if (corpo.stop_reason === 'max_tokens') {
    throw new Error('A resposta da I.A. foi cortada por tamanho. Tente uma conversa menor.')
  }

  const textoResposta = (corpo.content ?? [])
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('')
  const { analise, avisos } = validarAnalise(extrairJson(textoResposta))

  const tokensEntrada =
    (corpo.usage?.input_tokens ?? 0) + (corpo.usage?.cache_read_input_tokens ?? 0) + (corpo.usage?.cache_creation_input_tokens ?? 0)
  const tokensSaida = corpo.usage?.output_tokens ?? 0

  return {
    resultado: analise,
    modelo: corpo.model ?? modelo,
    tokensEntrada,
    tokensSaida,
    custoUsd: estimarCustoUsd(modelo, tokensEntrada, tokensSaida),
    demo: false,
    avisos,
  }
}
