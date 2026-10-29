import Link from 'next/link'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { TemperaturaBadge, EstagioBadge, TipoBadge } from '@/components/painel/Badges'
import LembreteAcoes from '@/components/painel/LembreteAcoes'
import { classificarLembrete, formatarDataCurta, iniciais, tempoRelativo } from '@/lib/painel/formato'
import { ROTULO_TEMPERATURA, TEMPERATURAS } from '@/lib/painel/tipos'

function isoDiasAtras(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

export default async function DashboardPage() {
  const corretor = (await getCorretorLogado())!
  const db = await getDb()
  const [clientes, lembretesPendentes, analisesRecentes] = await Promise.all([
    db.listarClientes(corretor.id),
    db.listarLembretes({ corretor_id: corretor.id, status: 'pendente' }),
    db.listarAnalisesRecentes(corretor.id, 5),
  ])
  const analisesSemana = await db.contarAnalisesDesde(corretor.id, isoDiasAtras(7))

  const porTemperatura = Object.fromEntries(TEMPERATURAS.map((t) => [t, clientes.filter((c) => c.temperatura === t).length]))
  const atrasados = lembretesPendentes.filter((l) => classificarLembrete(l.data) === 'atrasado')
  const hoje = lembretesPendentes.filter((l) => classificarLembrete(l.data) === 'hoje')
  const proximos = lembretesPendentes.filter((l) => classificarLembrete(l.data) === 'futuro').slice(0, 5)
  const nomeCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nome ?? null

  const saudacao = (() => {
    const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()))
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  })()

  return (
    <>
      <div className="p-head">
        <div>
          <h1>{saudacao}, {corretor.nome.split(' ')[0]}</h1>
          <p>Sua carteira em um olhar: quem está quente, o que vence hoje e o que a I.A. já leu por você.</p>
        </div>
        <Link href="/painel/analisar" className="p-btn p-btn-primary">+ Analisar conversa</Link>
      </div>

      <div className="p-grid p-grid-4" style={{ marginBottom: 18 }}>
        <div className="p-card p-stat">
          <small>Leads quentes</small>
          <strong>{porTemperatura.quente + porTemperatura.muito_quente}</strong>
          <span>{porTemperatura.muito_quente} muito quentes · {porTemperatura.quente} quentes</span>
        </div>
        <div className="p-card p-stat">
          <small>Mornos e frios</small>
          <strong>{porTemperatura.morno + porTemperatura.frio}</strong>
          <span>{porTemperatura.morno} mornos · {porTemperatura.frio} frios · {clientes.filter((c) => !c.temperatura).length} sem análise</span>
        </div>
        <div className="p-card p-stat">
          <small>Lembretes</small>
          <strong style={{ color: atrasados.length ? 'var(--p-danger)' : undefined }}>{hoje.length + atrasados.length}</strong>
          <span>{hoje.length} para hoje · {atrasados.length} atrasados</span>
        </div>
        <div className="p-card p-stat">
          <small>Análises na semana</small>
          <strong>{analisesSemana}</strong>
          <span>{clientes.length} clientes na carteira</span>
        </div>
      </div>

      <div className="p-grid p-grid-2" style={{ alignItems: 'start' }}>
        <section className="p-card">
          <div className="p-card-head">
            <h2>Clientes por temperatura</h2>
            <Link href="/painel/clientes" className="p-btn p-btn-sm">Ver todos</Link>
          </div>
          <table className="p-table">
            <thead><tr><th>Cliente</th><th>Temperatura</th><th>Estágio</th><th>Última interação</th></tr></thead>
            <tbody>
              {clientes.slice(0, 8).map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/painel/clientes/${c.id}`} className="p-row" style={{ gap: 10 }}>
                      <span className="p-avatar">{iniciais(c.nome)}</span>
                      <span>
                        <strong style={{ fontWeight: 500 }}>{c.nome}</strong>
                        <div className="p-small p-muted"><TipoBadge tipo={c.tipo} /></div>
                      </span>
                    </Link>
                  </td>
                  <td data-rotulo="Temperatura"><TemperaturaBadge nivel={c.temperatura} nota={c.nota_temperatura} /></td>
                  <td data-rotulo="Estágio"><EstagioBadge estagio={c.estagio} /></td>
                  <td data-rotulo="Última interação" className="p-muted">{tempoRelativo(c.ultima_interacao)}</td>
                </tr>
              ))}
              {clientes.length === 0 && <tr><td colSpan={4} className="p-muted" style={{ textAlign: 'center', padding: 20 }}>Nenhum cliente ainda. Analise a primeira conversa.</td></tr>}
            </tbody>
          </table>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="p-card">
            <div className="p-card-head">
              <h2>Lembretes pendentes</h2>
              <Link href="/painel/lembretes" className="p-btn p-btn-sm">Ver todos</Link>
            </div>
            {[...atrasados, ...hoje, ...proximos].length === 0 ? (
              <p className="p-muted">Nada pendente. Bom sinal, ou hora de analisar uma conversa.</p>
            ) : (
              <ul className="p-list">
                {[...atrasados, ...hoje, ...proximos].map((l) => {
                  const classe = classificarLembrete(l.data)
                  return (
                    <li key={l.id} className="p-row p-between">
                      <div>
                        <div className="p-row" style={{ gap: 8 }}>
                          <span className={`p-badge ${classe === 'atrasado' ? 'p-badge-danger' : classe === 'hoje' ? 'p-badge-warn' : 'p-badge-neutro'}`}>{formatarDataCurta(l.data)}</span>
                          <strong style={{ fontWeight: 500 }}>{l.titulo}</strong>
                        </div>
                        {l.cliente_id && <div className="p-small p-muted"><Link href={`/painel/clientes/${l.cliente_id}`}>{nomeCliente(l.cliente_id)}</Link>{l.origem === 'ia' ? ' · detectado pela I.A.' : ''}</div>}
                      </div>
                      <LembreteAcoes id={l.id} status={l.status} />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="p-card">
            <div className="p-card-head"><h2>Últimas análises</h2></div>
            {analisesRecentes.length === 0 ? (
              <p className="p-muted">Nenhuma análise ainda.</p>
            ) : (
              <ul className="p-list">
                {analisesRecentes.map((a) => (
                  <li key={a.id}>
                    <Link href={`/painel/analises/${a.id}`} className="p-row p-between">
                      <span><strong style={{ fontWeight: 500 }}>{nomeCliente(a.cliente_id) ?? 'Cliente'}</strong> <span className="p-muted p-small">· {tempoRelativo(a.criado_em)}</span></span>
                      <span className="p-row" style={{ gap: 6 }}>
                        <span className={`p-badge p-badge-${a.resultado.temperatura.nivel}`}>{ROTULO_TEMPERATURA[a.resultado.temperatura.nivel]} {a.resultado.temperatura.nota}</span>
                        {a.demo && <span className="p-badge p-badge-demo">demo</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
