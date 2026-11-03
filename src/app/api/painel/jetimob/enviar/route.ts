import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { enviarNotaJetimob, envioJetimobHabilitado } from '@/lib/painel/jetimob-escrita'

// Envia a nota de uma análise ao Jetimob (atrás da flag PAINEL_JETIMOB_ENVIO).
export async function POST(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  if (!envioJetimobHabilitado()) {
    return Response.json({ error: 'Envio ao Jetimob desabilitado. Copie o texto e cole no histórico do lead.' }, { status: 501 })
  }
  let body: { analise_id?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const db = await getDb()
  const analise = body.analise_id ? await db.obterAnalise(body.analise_id) : null
  if (!analise || analise.corretor_id !== auth.corretor.id) return Response.json({ error: 'Análise não encontrada' }, { status: 404 })
  const cliente = await db.obterCliente(analise.cliente_id)
  if (!cliente?.telefone) return Response.json({ error: 'O cliente precisa ter telefone para registrar no Jetimob.' }, { status: 400 })
  try {
    await enviarNotaJetimob({
      nomeCliente: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email,
      codigoImovel: analise.resultado.fatos.imoveis_citados[0] ?? null,
      texto: analise.resultado.texto_jetimob,
      corretorEmail: auth.corretor.email ?? undefined,
    })
  } catch (err) {
    console.error('Painel: erro ao enviar ao Jetimob:', err)
    return Response.json({ error: 'Falha ao enviar ao Jetimob. Copie o texto manualmente.' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
