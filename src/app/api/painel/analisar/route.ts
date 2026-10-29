import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { analisarConversa, iaDisponivel } from '@/lib/painel/analise'
import { ErroAnaliseInvalida } from '@/lib/painel/analise-schema'
import { detectarDataConversa, extrairTexto } from '@/lib/painel/extrair-texto'
import type { TipoCliente } from '@/lib/painel/tipos'

// A análise pode levar dezenas de segundos em conversas longas.
export const maxDuration = 60

const TIPOS: TipoCliente[] = ['comprador', 'locatario', 'proprietario', 'indefinido']
const MAX_CARACTERES = 120_000

// Recebe multipart/form-data: texto OU arquivo, mais os campos opcionais.
// Salva cliente, conversa e análise, e devolve tudo para a tela.
export async function POST(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const { corretor } = auth

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Envie o formulário como multipart/form-data' }, { status: 400 })
  }

  let texto = String(form.get('texto') ?? '').trim()
  let nomeArquivo: string | null = null
  const avisos: string[] = []
  const arquivo = form.get('arquivo')
  if (arquivo instanceof File && arquivo.size > 0) {
    try {
      const extraido = await extrairTexto(arquivo)
      texto = extraido.texto.trim()
      nomeArquivo = arquivo.name
      if (extraido.aviso) avisos.push(extraido.aviso)
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Falha ao ler o arquivo' }, { status: 400 })
    }
  }
  if (texto.length < 20) {
    return Response.json({ error: 'Cole a conversa (ao menos algumas linhas) ou envie um arquivo.' }, { status: 400 })
  }
  if (texto.length > MAX_CARACTERES) {
    return Response.json({ error: `Conversa muito longa (${texto.length} caracteres). Limite: ${MAX_CARACTERES}.` }, { status: 400 })
  }

  const clienteNome = String(form.get('cliente_nome') ?? '').trim() || null
  const clienteTelefone = String(form.get('cliente_telefone') ?? '').trim() || null
  const codigoImovel = String(form.get('codigo_imovel') ?? '').trim().toUpperCase() || null
  const tipoBruto = String(form.get('tipo_cliente') ?? '')
  const tipoCliente: TipoCliente = (TIPOS as string[]).includes(tipoBruto) ? (tipoBruto as TipoCliente) : 'indefinido'
  const dataInformada = String(form.get('data_conversa') ?? '').trim()
  const dataConversa = /^\d{4}-\d{2}-\d{2}$/.test(dataInformada)
    ? dataInformada
    : detectarDataConversa(texto) ?? new Date().toISOString().slice(0, 10)
  const origem = nomeArquivo ? 'arquivo' : String(form.get('origem') ?? 'colado')

  let saida
  try {
    saida = await analisarConversa({
      conversa: texto,
      dataConversa,
      corretorNome: corretor.nome,
      clienteNome,
      clienteTelefone,
      codigoImovel,
      tipoCliente,
    })
  } catch (err) {
    console.error('Painel: erro na análise:', err)
    const msg = err instanceof ErroAnaliseInvalida ? 'A I.A. devolveu uma análise fora do formato esperado. Tente novamente.' : err instanceof Error ? err.message : 'Falha na análise'
    return Response.json({ error: msg }, { status: 502 })
  }
  avisos.push(...saida.avisos)
  if (saida.demo) avisos.unshift('Modo demonstração: ANTHROPIC_API_KEY não configurada. Este resultado é um exemplo fixo.')

  // Persistência: cliente (por telefone, depois por nome), conversa, análise,
  // imóveis de interesse. Lembretes só são criados quando o corretor clica.
  const db = await getDb()
  const r = saida.resultado
  const nomeFinal = clienteNome ?? r.fatos.contato.nome ?? 'Cliente sem nome'
  const telefoneFinal = clienteTelefone ?? r.fatos.contato.telefone
  const tipoFinal: TipoCliente = tipoCliente !== 'indefinido' ? tipoCliente : deduzirTipo(texto)

  let cliente = telefoneFinal ? await db.buscarClientePorTelefone(telefoneFinal, corretor.id) : null
  if (!cliente && nomeFinal !== 'Cliente sem nome') cliente = await db.buscarClientePorNome(nomeFinal, corretor.id)
  if (!cliente) {
    cliente = await db.criarCliente({
      corretor_id: corretor.id,
      nome: nomeFinal,
      telefone: telefoneFinal,
      email: r.fatos.contato.email,
      tipo: tipoFinal,
      origem: nomeArquivo ? 'WhatsApp (arquivo)' : 'Conversa colada',
    })
  }

  const conversa = await db.criarConversa({
    cliente_id: cliente.id,
    corretor_id: corretor.id,
    texto,
    data_conversa: `${dataConversa}T12:00:00.000Z`,
    origem,
    nome_arquivo: nomeArquivo,
  })

  const analise = await db.criarAnalise({
    conversa_id: conversa.id,
    cliente_id: cliente.id,
    corretor_id: corretor.id,
    resultado: r,
    modelo: saida.modelo,
    tokens_entrada: saida.tokensEntrada,
    tokens_saida: saida.tokensSaida,
    custo_usd: saida.custoUsd,
    demo: saida.demo,
  })

  await db.atualizarCliente(cliente.id, {
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
  if (codigoImovel) codigos.add(codigoImovel)
  for (const codigo of codigos) await db.adicionarImovelInteresse(cliente.id, codigo, 'ia')

  return Response.json({
    ok: true,
    demo: saida.demo,
    ia_disponivel: iaDisponivel(),
    avisos,
    analise: { ...analise, cliente_nome: cliente.nome },
    cliente_id: cliente.id,
    data_conversa: dataConversa,
  })
}

function deduzirTipo(texto: string): TipoCliente {
  const t = texto.toLowerCase()
  if (/\b(meu im[oó]vel|minha casa|meu apartamento|quero vender|quero alugar (minha|meu)|anunciar|exclusividade)\b/.test(t)) return 'proprietario'
  if (/\b(temporada|di[aá]ria|r[eé]veillon|carnaval|alugar|aluguel|loca[cç][aã]o)\b/.test(t)) return 'locatario'
  if (/\b(comprar|financiamento|financiar|entrada|fgts|[àa] vista|proposta)\b/.test(t)) return 'comprador'
  return 'indefinido'
}
