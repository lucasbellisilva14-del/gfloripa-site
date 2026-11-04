// Fluxo compartilhado "analisar e guardar": chama a I.A., cria ou reaproveita
// o cliente, grava a conversa, a análise e os imóveis de interesse, e
// atualiza o resumo do cliente.
//
// Usado pela tela de colar conversa (/api/painel/analisar) e pela análise de
// uma conversa do WhatsApp (/api/painel/whatsapp/analisar), para as duas se
// comportarem exatamente igual.

import { analisarConversa, type SaidaAnalise } from './analise'
import type { ImagemEnviada } from './extrair-conteudo'
import { getDb } from './db'
import type { Analise, Cliente, Conversa, CorretorLogado, TipoCliente } from './tipos'

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
}

export async function analisarERegistrar(e: EntradaRegistro): Promise<ResultadoRegistro> {
  const saida = await analisarConversa({
    conversa: e.texto,
    imagens: e.imagens,
    dataConversa: e.dataConversa,
    corretorNome: e.corretor.nome,
    clienteNome: e.clienteNome,
    clienteTelefone: e.clienteTelefone,
    codigoImovel: e.codigoImovel,
    tipoCliente: e.tipoCliente,
  })

  const db = await getDb()
  const r = saida.resultado
  const nomeFinal = e.clienteNome?.trim() || r.fatos.contato.nome || 'Cliente sem nome'
  const telefoneFinal = e.clienteTelefone?.trim() || r.fatos.contato.telefone
  const tipoFinal: TipoCliente =
    e.tipoCliente && e.tipoCliente !== 'indefinido' ? e.tipoCliente : deduzirTipo(e.texto)

  let cliente: Cliente | null = null
  if (e.clienteExistenteId) cliente = await db.obterCliente(e.clienteExistenteId)
  if (!cliente && telefoneFinal) cliente = await db.buscarClientePorTelefone(telefoneFinal, e.corretor.id)
  if (!cliente && nomeFinal !== 'Cliente sem nome') cliente = await db.buscarClientePorNome(nomeFinal, e.corretor.id)
  if (!cliente) {
    cliente = await db.criarCliente({
      corretor_id: e.corretor.id,
      nome: nomeFinal,
      telefone: telefoneFinal,
      email: r.fatos.contato.email,
      tipo: tipoFinal,
      origem: e.origem,
    })
  }

  // conversa que chegou só como print: guardamos a transcrição lida pela I.A.,
  // senão o histórico do cliente ficaria com uma entrada vazia
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

  const atualizado = await db.atualizarCliente(cliente.id, {
    temperatura: r.temperatura.nivel,
    nota_temperatura: r.temperatura.nota,
    estagio: r.estagio,
    resumo: r.resumo,
    ultima_interacao: conversa.data_conversa,
    ...(cliente.tipo === 'indefinido' && tipoFinal !== 'indefinido' ? { tipo: tipoFinal } : {}),
    ...(!cliente.telefone && telefoneFinal ? { telefone: telefoneFinal } : {}),
    ...(!cliente.email && r.fatos.contato.email ? { email: r.fatos.contato.email } : {}),
  })

  const codigos = new Set(r.fatos.imoveis_citados)
  if (e.codigoImovel) codigos.add(e.codigoImovel)
  for (const codigo of codigos) await db.adicionarImovelInteresse(cliente.id, codigo, 'ia')

  return { saida, cliente: atualizado ?? cliente, conversa, analise }
}

// Palpite do tipo de cliente quando o corretor não informa; a I.A. também
// deduz pela conversa, isto é só um ponto de partida para o cadastro.
export function deduzirTipo(texto: string): TipoCliente {
  const t = texto.toLowerCase()
  if (/\b(meu im[oó]vel|minha casa|meu apartamento|quero vender|quero alugar (minha|meu)|anunciar|exclusividade)\b/.test(t)) return 'proprietario'
  if (/\b(temporada|di[aá]ria|r[eé]veillon|carnaval|alugar|aluguel|loca[cç][aã]o)\b/.test(t)) return 'locatario'
  if (/\b(comprar|financiamento|financiar|entrada|fgts|[àa] vista|proposta)\b/.test(t)) return 'comprador'
  return 'indefinido'
}
