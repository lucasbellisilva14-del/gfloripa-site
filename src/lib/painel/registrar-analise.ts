// Fluxo compartilhado "analisar e guardar": acha o cliente, monta o histórico
// que o painel já tem dele, chama a I.A. com esse contexto, grava conversa e
// análise, e atualiza a ficha.
//
// Usado pela tela de colar conversa (/api/painel/analisar) e pela análise de
// uma conversa do WhatsApp (/api/painel/whatsapp/analisar), para as duas se
// comportarem exatamente igual.
//
// Por que o histórico importa: um trecho curto do WhatsApp, avaliado sozinho,
// rebaixava a temperatura de um cliente já quente e trocava o tipo. Com o
// histórico no prompt, a I.A. avalia a pessoa, não o pedaço.

import { analisarConversa, type HistoricoCliente, type SaidaAnalise } from './analise'
import type { ImagemEnviada } from './extrair-conteudo'
import { getDb, normalizarTelefone } from './db'
import type { Analise, Cliente, Conversa, CorretorLogado, TipoCliente } from './tipos'
import { ROTULO_ESTAGIO, ROTULO_TEMPERATURA, ROTULO_TIPO_CLIENTE } from './tipos'

export type EntradaRegistro = {
  corretor: CorretorLogado
  texto: string
  // prints da conversa; quando vêm sozinhos, o texto guardado no histórico é
  // a transcrição que a própria I.A. devolve
  imagens?: ImagemEnviada[]
  dataConversa: string // AAAA-MM-DD
  clienteNome?: string | null
  clienteTelefone?: string | null
  codigoImovel?: string | null
  // tipo escolhido pelo corretor no formulário: vale como fixação manual
  tipoCliente?: TipoCliente
  origem: string
  nomeArquivo?: string | null
  // quando a conversa já pertence a um cliente conhecido (chat vinculado)
  clienteExistenteId?: string | null
}

export type ResultadoRegistro = {
  saida: SaidaAnalise
  cliente: Cliente
  conversa: Conversa
  analise: Analise
  // true quando a análise recebeu o histórico de um cliente já conhecido
  comHistorico: boolean
}

// Quanto de conversa anterior entra no prompt. Acima disso, mantém o mais
// recente: é o que mais pesa para temperatura e próximos passos.
const LIMITE_HISTORICO_CHARS = 40_000

export function montarHistorico(cliente: Cliente, conversas: Conversa[], analises: Analise[]): HistoricoCliente | null {
  if (!conversas.length && !analises.length) return null
  const ultima = analises[0]?.resultado ?? null
  const linhasFatos: string[] = []
  if (ultima) {
    const f = ultima.fatos
    const pares: [string, string | null][] = [
      ['Orçamento', f.orcamento],
      ['Pagamento', f.forma_pagamento],
      ['Prazo', f.prazo],
      ['Família', f.composicao_familiar],
      ['Região', f.regiao_desejada],
      ['Tipo de imóvel', f.tipo_imovel],
      ['Imóveis citados', f.imoveis_citados.join(', ') || null],
      ['Objeções', f.objecoes.join('; ') || null],
    ]
    for (const [k, v] of pares) if (v) linhasFatos.push(`${k}: ${v}`)
  }

  // conversas mais recentes primeiro, até o limite de caracteres
  const ordenadas = [...conversas].sort((a, b) => b.data_conversa.localeCompare(a.data_conversa))
  const trechos: string[] = []
  let total = 0
  for (const c of ordenadas) {
    const cab = `[conversa de ${c.data_conversa.slice(0, 10)}, origem ${c.origem}]`
    const restante = LIMITE_HISTORICO_CHARS - total - cab.length - 2
    if (restante <= 200) break
    const corpo = c.texto.length > restante ? `${c.texto.slice(0, restante)}\n[... trecho cortado ...]` : c.texto
    trechos.push(`${cab}\n${corpo}`)
    total += cab.length + corpo.length + 2
  }

  return {
    tipoRegistrado: cliente.tipo,
    tipoFixadoManualmente: cliente.tipo_origem === 'manual',
    avaliacaoAnterior: ultima
      ? `${ROTULO_TEMPERATURA[ultima.temperatura.nivel]} (${ultima.temperatura.nota}/100), estágio ${ROTULO_ESTAGIO[ultima.estagio]}, em ${analises[0].criado_em.slice(0, 10)}`
      : null,
    resumoAnterior: ultima?.resumo ?? cliente.resumo ?? null,
    fatosAnteriores: linhasFatos,
    conversasAnteriores: trechos,
    totalAnalises: analises.length,
  }
}

export async function analisarERegistrar(e: EntradaRegistro): Promise<ResultadoRegistro> {
  const db = await getDb()

  // 1. Quem é o cliente, antes de chamar a I.A., para mandar o histórico junto.
  let cliente: Cliente | null = null
  if (e.clienteExistenteId) cliente = await db.obterCliente(e.clienteExistenteId)
  if (!cliente && e.clienteTelefone?.trim()) cliente = await db.buscarClientePorTelefone(e.clienteTelefone, e.corretor.id)
  if (!cliente && e.clienteNome?.trim()) cliente = await db.buscarClientePorNome(e.clienteNome, e.corretor.id)

  let historico: HistoricoCliente | null = null
  if (cliente) {
    const [conversas, analises] = await Promise.all([db.listarConversasDoCliente(cliente.id), db.listarAnalisesDoCliente(cliente.id)])
    historico = montarHistorico(cliente, conversas, analises)
  }

  // tipo que vai como dica para a I.A.: o fixado pelo corretor vale acima de tudo
  const tipoFixado: TipoCliente | undefined =
    e.tipoCliente && e.tipoCliente !== 'indefinido'
      ? e.tipoCliente
      : cliente?.tipo_origem === 'manual' && cliente.tipo !== 'indefinido'
        ? cliente.tipo
        : undefined

  // 2. Análise.
  const saida = await analisarConversa({
    conversa: e.texto,
    imagens: e.imagens,
    dataConversa: e.dataConversa,
    corretorNome: e.corretor.nome,
    clienteNome: e.clienteNome ?? cliente?.nome,
    clienteTelefone: e.clienteTelefone ?? cliente?.telefone,
    codigoImovel: e.codigoImovel,
    tipoCliente: tipoFixado,
    historico,
  })
  const r = saida.resultado

  // 3. Cliente ainda desconhecido: tenta pelo que a I.A. extraiu, senão cria.
  const nomeFinal = e.clienteNome?.trim() || r.fatos.contato.nome || 'Cliente sem nome'
  const telefoneFinal = e.clienteTelefone?.trim() || r.fatos.contato.telefone
  if (!cliente && telefoneFinal) cliente = await db.buscarClientePorTelefone(telefoneFinal, e.corretor.id)
  if (!cliente && nomeFinal !== 'Cliente sem nome') {
    // Nome extraído pela I.A. só casa com um cliente existente se os telefones
    // não se contradisserem: duas pessoas com o mesmo nome e telefones
    // diferentes são clientes diferentes.
    const porNome = await db.buscarClientePorNome(nomeFinal, e.corretor.id)
    const telA = normalizarTelefone(porNome?.telefone)
    const telB = normalizarTelefone(telefoneFinal)
    if (porNome && (!telA || !telB || telA === telB)) cliente = porNome
  }

  const tipoDaIa: TipoCliente = r.tipo_cliente !== 'indefinido' ? r.tipo_cliente : deduzirTipo(e.texto)
  if (!cliente) {
    cliente = await db.criarCliente({
      corretor_id: e.corretor.id,
      nome: nomeFinal,
      telefone: telefoneFinal,
      email: r.fatos.contato.email,
      tipo: tipoFixado ?? tipoDaIa,
      tipo_origem: tipoFixado && e.tipoCliente ? 'manual' : 'ia',
      origem: e.origem,
    })
  }

  // 4. Conversa e análise.
  const textoGuardado =
    e.texto.trim() ||
    r.transcricao ||
    `[${e.imagens?.length ?? 0} print(s) de conversa, sem transcrição legível]`

  const conversa = await db.criarConversa({
    cliente_id: cliente.id,
    corretor_id: e.corretor.id,
    texto: textoGuardado,
    data_conversa: `${e.dataConversa}T12:00:00.000Z`,
    origem: e.origem,
    nome_arquivo: e.nomeArquivo ?? null,
  })

  const analise = await db.criarAnalise({
    conversa_id: conversa.id,
    cliente_id: cliente.id,
    corretor_id: e.corretor.id,
    resultado: r,
    modelo: saida.modelo,
    tokens_entrada: saida.tokensEntrada,
    tokens_saida: saida.tokensSaida,
    custo_usd: saida.custoUsd,
    demo: saida.demo,
  })

  // 5. Ficha: temperatura e estágio sempre acompanham a análise mais recente
  // (que agora enxerga o histórico). Tipo: manual nunca é tocado; vindo do
  // formulário vira manual; senão a I.A. pode atualizar.
  const patchTipo: Partial<Pick<Cliente, 'tipo' | 'tipo_origem'>> =
    e.tipoCliente && e.tipoCliente !== 'indefinido'
      ? { tipo: e.tipoCliente, tipo_origem: 'manual' }
      : cliente.tipo_origem === 'manual'
        ? {}
        : r.tipo_cliente !== 'indefinido' && r.tipo_cliente !== cliente.tipo
          ? { tipo: r.tipo_cliente, tipo_origem: 'ia' }
          : cliente.tipo === 'indefinido' && tipoDaIa !== 'indefinido'
            ? { tipo: tipoDaIa, tipo_origem: 'ia' }
            : {}

  const atualizado = await db.atualizarCliente(cliente.id, {
    temperatura: r.temperatura.nivel,
    nota_temperatura: r.temperatura.nota,
    estagio: r.estagio,
    resumo: r.resumo,
    ultima_interacao: conversa.data_conversa,
    ...patchTipo,
    ...(!cliente.telefone && telefoneFinal ? { telefone: telefoneFinal } : {}),
    ...(!cliente.email && r.fatos.contato.email ? { email: r.fatos.contato.email } : {}),
    ...(cliente.nome === 'Cliente sem nome' && nomeFinal !== 'Cliente sem nome' ? { nome: nomeFinal } : {}),
  })

  const codigos = new Set(r.fatos.imoveis_citados)
  if (e.codigoImovel) codigos.add(e.codigoImovel)
  for (const codigo of codigos) await db.adicionarImovelInteresse(cliente.id, codigo, 'ia')

  return { saida, cliente: atualizado ?? cliente, conversa, analise, comHistorico: historico !== null }
}

// Último recurso quando nem o corretor nem a I.A. definiram o tipo. É só um
// palpite por palavras; a I.A. com o histórico é quem decide de verdade.
export function deduzirTipo(texto: string): TipoCliente {
  const t = texto.toLowerCase()
  if (/\b(meu im[oó]vel|minha casa|meu apartamento|quero vender|quero alugar (minha|meu)|anunciar|exclusividade)\b/.test(t)) return 'proprietario'
  if (/\b(comprar|financiamento|financiar|entrada|fgts|[àa] vista|proposta)\b/.test(t)) return 'comprador'
  if (/\b(temporada|di[aá]ria|r[eé]veillon|carnaval|alugar|aluguel|loca[cç][aã]o)\b/.test(t)) return 'locatario'
  return 'indefinido'
}

export { ROTULO_TIPO_CLIENTE }
