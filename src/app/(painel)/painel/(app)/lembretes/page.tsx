import Link from 'next/link'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import LembreteAcoes from '@/components/painel/LembreteAcoes'
import NovoLembreteForm from '@/components/painel/NovoLembreteForm'
import { classificarLembrete, formatarData } from '@/lib/painel/formato'
import type { Lembrete } from '@/lib/painel/tipos'

export default async function LembretesPage() {
  const corretor = (await getCorretorLogado())!
  const db = await getDb()
  const [todos, clientes] = await Promise.all([db.listarLembretes({ corretor_id: corretor.id }), db.listarClientes(corretor.id)])
  const nome = (id: string | null) => clientes.find((c) => c.id === id)?.nome ?? null
  const pendentes = todos.filter((l) => l.status === 'pendente')
  const grupos: [string, Lembrete[]][] = [
    ['Atrasados', pendentes.filter((l) => classificarLembrete(l.data) === 'atrasado')],
    ['Hoje', pendentes.filter((l) => classificarLembrete(l.data) === 'hoje')],
    ['Próximos', pendentes.filter((l) => classificarLembrete(l.data) === 'futuro')],
    ['Concluídos e cancelados', todos.filter((l) => l.status !== 'pendente').slice(-20).reverse()],
  ]
  return (
    <>
      <div className="p-head">
        <div>
          <h1>Lembretes</h1>
          <p>Tarefas combinadas nas conversas (detectadas pela I.A.) e lembretes manuais.</p>
        </div>
      </div>
      <div className="p-card" style={{ marginBottom: 16 }}>
        <NovoLembreteForm clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))} />
      </div>
      {grupos.map(([titulo, lista]) => (
        <section key={titulo} className="p-card">
          <div className="p-card-head">
            <h2>{titulo}</h2>
            <span className="p-badge p-badge-neutro">{lista.length}</span>
          </div>
          {lista.length === 0 ? (
            <p className="p-muted">Nada aqui.</p>
          ) : (
            <ul className="p-list">
              {lista.map((l) => (
                <li key={l.id} className="p-row p-between">
                  <div>
                    <strong style={{ fontWeight: 500, textDecoration: l.status === 'concluido' ? 'line-through' : undefined }}>{l.titulo}</strong>
                    <div className="p-small p-muted">
                      {formatarData(l.data)}
                      {l.cliente_id && <> · <Link href={`/painel/clientes/${l.cliente_id}`}>{nome(l.cliente_id)}</Link></>}
                      {l.origem === 'ia' ? ' · detectado pela I.A.' : ''}
                      {l.descricao ? ` · ${l.descricao}` : ''}
                    </div>
                  </div>
                  <LembreteAcoes id={l.id} status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  )
}
