import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { iaDisponivel } from '@/lib/painel/analise'
import { analisarERegistrar } from '@/lib/painel/registrar-analise'
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

  let registro
  try {
    registro = await analisarERegistrar({
      corretor,
      texto,
      dataConversa,
      clienteNome,
      clienteTelefone,
      codigoImovel,
      tipoCliente,
      origem,
      nomeArquivo,
    })
  } catch (err) {
    console.error('Painel: erro na análise:', err)
    const msg =
      err instanceof ErroAnaliseInvalida
        ? 'A I.A. devolveu uma análise fora do formato esperado. Tente novamente.'
        : err instanceof Error
          ? err.message
          : 'Falha na análise'
    return Response.json({ error: msg }, { status: 502 })
  }

  const { saida, cliente, analise } = registro
  avisos.push(...saida.avisos)
  if (saida.demo) avisos.unshift('Modo demonstração: ANTHROPIC_API_KEY não configurada. Este resultado é um exemplo fixo.')

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
