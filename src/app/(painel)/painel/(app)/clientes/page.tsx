import Link from 'next/link'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { TemperaturaBadge, EstagioBadge, TipoBadge } from '@/components/painel/Badges'
import NovoClienteForm from '@/components/painel/NovoClienteForm'
import { iniciais, tempoRelativo } from '@/lib/painel/formato'

export default async function ClientesPage() {
  const corretor = (await getCorretorLogado())!
  const db = await getDb()
  const clientes = await db.listarClientes(corretor.id)
  return (
    <>
      <div className="p-head">
        <div>
          <h1>Clientes</h1>
          <p>{clientes.length} na carteira, ordenados por temperatura e última interação.</p>
        </div>
        <NovoClienteForm />
      </div>
      <div className="p-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="p-table">
          <thead><tr><th>Cliente</th><th>Tipo</th><th>Temperatura</th><th>Estágio</th><th>Origem</th><th>Última interação</th></tr></thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/painel/clientes/${c.id}`} className="p-row" style={{ gap: 10 }}>
                    <span className="p-avatar">{iniciais(c.nome)}</span>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{c.nome}</strong>
                      <div className="p-small p-muted">{c.telefone ?? 'sem telefone'}</div>
                    </span>
                  </Link>
                </td>
                <td data-rotulo="Tipo"><TipoBadge tipo={c.tipo} /></td>
                <td data-rotulo="Temperatura"><TemperaturaBadge nivel={c.temperatura} nota={c.nota_temperatura} /></td>
                <td data-rotulo="Estágio"><EstagioBadge estagio={c.estagio} /></td>
                <td data-rotulo="Origem" className="p-muted">{c.origem ?? '-'}</td>
                <td data-rotulo="Última interação" className="p-muted">{tempoRelativo(c.ultima_interacao)}</td>
              </tr>
            ))}
            {clientes.length === 0 && <tr><td colSpan={6} className="p-muted" style={{ textAlign: 'center', padding: 24 }}>Nenhum cliente. <Link href="/painel/analisar">Analise uma conversa</Link> para começar.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
