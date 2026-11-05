import Link from 'next/link'
import { notFound } from 'next/navigation'
import AnaliseResultadoView from '@/components/painel/AnaliseResultadoView'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { envioJetimobHabilitado } from '@/lib/painel/jetimob-escrita'
import { formatarData } from '@/lib/painel/formato'

export default async function AnalisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const corretor = (await getCorretorLogado())!
  const db = await getDb()
  const analise = await db.obterAnalise(id)
  const gestor = corretor.papel === 'gestor'
  if (!analise || (analise.corretor_id !== corretor.id && !gestor)) notFound()
  const somenteLeitura = analise.corretor_id !== corretor.id
  const [cliente, conversa, lembretes] = await Promise.all([
    db.obterCliente(analise.cliente_id),
    db.obterConversa(analise.conversa_id),
    db.listarLembretes({ corretor_id: analise.corretor_id, cliente_id: analise.cliente_id }),
  ])
  return (
    <>
      <div className="p-head">
        <div>
          <h1>Análise de {cliente?.nome ?? 'cliente'}</h1>
          <p>Conversa de {formatarData(conversa?.data_conversa, false)} · analisada em {formatarData(analise.criado_em)}</p>
        </div>
        <Link href={`/painel/clientes/${analise.cliente_id}`} className="p-btn">Ver cliente</Link>
      </div>
      {somenteLeitura && <div className="p-alert p-alert-info" style={{ marginBottom: 16 }} data-teste="somente-leitura">Análise de outro corretor. Somente visualização.</div>}
      <AnaliseResultadoView
        analise={analise}
        somenteLeitura={somenteLeitura}
        envioJetimob={envioJetimobHabilitado() && !somenteLeitura}
        lembretesCriados={lembretes.filter((l) => l.analise_id === analise.id).map((l) => ({ titulo: l.titulo, data: l.data }))}
      />
      {conversa && (
        <details className="p-card" style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Conversa original{conversa.nome_arquivo ? ` (${conversa.nome_arquivo})` : ''}</summary>
          <pre className="p-pre p-mono" style={{ marginTop: 12, maxHeight: 480, overflow: 'auto' }}>{conversa.texto}</pre>
        </details>
      )}
    </>
  )
}
