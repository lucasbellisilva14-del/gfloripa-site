import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { iaDisponivel } from '@/lib/painel/analise'
import { analisarERegistrar } from '@/lib/painel/registrar-analise'
import { ErroAnaliseInvalida } from '@/lib/painel/analise-schema'
import { dataDaConversa, montarTranscricao } from '@/lib/painel/transcricao'

export const maxDuration = 60

const MAX_CARACTERES = 120_000

// Analisa uma conversa capturada do WhatsApp e vincula o chat ao cliente.
export async function POST(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const { corretor } = auth

  let body: { chat_id?: string; codigo_imovel?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const db = await getDb()
  const chat = body.chat_id ? await db.obterChatWhatsapp(body.chat_id) : null
  if (!chat || chat.corretor_id !== corretor.id) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }

  const mensagens = await db.listarMensagensDoChat(chat.id)
  if (mensagens.length < 2) {
    return Response.json({ error: 'Conversa muito curta para analisar.' }, { status: 400 })
  }

  let texto = montarTranscricao(chat, mensagens, corretor.nome)
  if (texto.length > MAX_CARACTERES) {
    // conversa longa: mantém o trecho mais recente, que é o que importa
    texto = texto.slice(-MAX_CARACTERES)
  }

  let registro
  try {
    registro = await analisarERegistrar({
      corretor,
      texto,
      dataConversa: dataDaConversa(mensagens),
      clienteNome: chat.nome,
      clienteTelefone: chat.telefone,
      codigoImovel: body.codigo_imovel?.trim().toUpperCase() || null,
      origem: 'WhatsApp',
      clienteExistenteId: chat.cliente_id,
    })
  } catch (err) {
    console.error('Painel: erro ao analisar conversa do WhatsApp:', err)
    const msg =
      err instanceof ErroAnaliseInvalida
        ? 'A I.A. devolveu uma análise fora do formato esperado. Tente novamente.'
        : err instanceof Error
          ? err.message
          : 'Falha na análise'
    return Response.json({ error: msg }, { status: 502 })
  }

  // liga o chat ao cliente para as próximas análises caírem na mesma ficha
  if (!chat.cliente_id) await db.atualizarChatWhatsapp(chat.id, { cliente_id: registro.cliente.id })

  const avisos = [...registro.saida.avisos]
  if (registro.saida.demo) avisos.unshift('Modo demonstração: ANTHROPIC_API_KEY não configurada. Este resultado é um exemplo fixo.')

  return Response.json({
    ok: true,
    demo: registro.saida.demo,
    ia_disponivel: iaDisponivel(),
    avisos,
    analise: { ...registro.analise, cliente_nome: registro.cliente.nome },
    cliente_id: registro.cliente.id,
    mensagens_analisadas: mensagens.length,
  })
}
