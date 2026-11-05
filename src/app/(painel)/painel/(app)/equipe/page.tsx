import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { montarVisaoEquipe } from '@/lib/painel/equipe'
import { obterRelatorioGuardado } from '@/lib/painel/relatorio-equipe'
import { iaDisponivel } from '@/lib/painel/analise'
import RelatorioEquipe from '@/components/painel/RelatorioEquipe'
import { TemperaturaBadge, EstagioBadge, TipoBadge } from '@/components/painel/Badges'
import { formatarData, formatarUsd, iniciais, tempoRelativo } from '@/lib/painel/formato'
import { ESTAGIOS, ROTULO_ESTAGIO, ROTULO_TEMPERATURA } from '@/lib/painel/tipos'

// Painel do gestor: visão da equipe inteira, somente leitura. As fichas e
// análises dos outros corretores abrem em modo de visualização.
export default async function EquipePage({ searchParams }: { searchParams: Promise<{ corretor?: string }> }) {
  const corretor = (await getCorretorLogado())!
  if (corretor.papel !== 'gestor') notFound()
  const { corretor: filtroBruto } = await searchParams
  const filtro = filtroBruto ? Number(filtroBruto) : null

  const db = await getDb()
  const [visao, relatorio] = await Promise.all([montarVisaoEquipe(db), obterRelatorioGuardado(db)])
  const t = visao.totais
  const selecionado = filtro ? visao.porCorretor.find((r) => r.corretor.id === filtro) ?? null : null
  const clientes = (selecionado ? visao.clientes.filter((c) => c.corretor_id === selecionado.corretor.id) : visao.clientes).slice(0, 60)
  const analises = (selecionado ? visao.analises.filter((a) => a.corretor_id === selecionado.corretor.id) : visao.analises).slice(0, 25)
  const maxFunil = Math.max(1, ...Object.values(visao.funil))
  const corNota = (n: number | null) => (n === null ? undefined : n >= 75 ? 'var(--p-ok, #2e9e5b)' : n >= 50 ? undefined : 'var(--p-danger)')

  return (
    <>
      <div className="p-head">
        <div>
          <h1>Equipe</h1>
          <p>Visão do gestor: carteira, atendimento e evolução de cada corretor. Somente leitura: as fichas abrem para consulta.</p>
        </div>
        {selecionado && <Link href="/painel/equipe" className="p-btn">Ver equipe inteira</Link>}
      </div>

      <div className="p-grid p-grid-4" style={{ marginBottom: 18 }}>
        <div className="p-card p-stat">
          <small>Clientes da equipe</small>
          <strong>{t.clientes}</strong>
          <span>{t.quentes} quentes · {t.semAnalise} sem análise</span>
        </div>
        <div className="p-card p-stat">
          <small>Análises</small>
          <strong>{t.analisesSemana}</strong>
          <span>na semana · {t.analises30} em 30 dias · {t.analisesTotal} no total</span>
        </div>
        <div className="p-card p-stat">
          <small>Nota do atendimento</small>
          <strong style={{ color: corNota(t.notaAtendimento) }}>{t.notaAtendimento ?? '--'}</strong>
          <span>média das análises (30 dias) · custo {formatarUsd(t.custo30Usd)}</span>
        </div>
        <div className="p-card p-stat">
          <small>Lembretes</small>
          <strong style={{ color: t.lembretesAtrasados ? 'var(--p-danger)' : undefined }}>{t.lembretesAtrasados}</strong>
          <span>atrasados · {t.lembretesHoje} para hoje · {t.corretoresAtivos} corretores ativos</span>
        </div>
      </div>

      <section className="p-card" style={{ marginBottom: 16 }}>
        <div className="p-card-head"><h2>Por corretor</h2><span className="p-small p-muted">clique no nome para filtrar as listas abaixo</span></div>
        <table className="p-table" data-teste="equipe-corretores">
          <thead><tr><th>Corretor</th><th>Clientes</th><th>Quentes</th><th>Análises (semana / total)</th><th>Atendimento</th><th>Lembretes</th><th>Última atividade</th></tr></thead>
          <tbody>
            {visao.porCorretor.map((r) => (
              <tr key={r.corretor.id} style={{ opacity: r.corretor.ativo ? 1 : 0.55, background: selecionado?.corretor.id === r.corretor.id ? 'rgba(232,178,58,.08)' : undefined }}>
                <td>
                  <Link href={`/painel/equipe?corretor=${r.corretor.id}`} className="p-row" style={{ gap: 10 }}>
                    <span className="p-avatar">{iniciais(r.corretor.nome)}</span>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{r.corretor.nome}</strong>
                      <div className="p-small p-muted">{r.corretor.papel === 'gestor' ? 'gestor' : 'corretor'}{r.corretor.ativo ? '' : ' · desativado'}</div>
                    </span>
                  </Link>
                </td>
                <td data-rotulo="Clientes">{r.clientes}{r.semAnalise ? <span className="p-small p-muted"> · {r.semAnalise} sem análise</span> : null}</td>
                <td data-rotulo="Quentes">{r.quentes}{r.quentesParados ? <span className="p-small" style={{ color: 'var(--p-danger)' }}> · {r.quentesParados} parado(s)</span> : null}</td>
                <td data-rotulo="Análises">{r.analisesSemana} / {r.analisesTotal}</td>
                <td data-rotulo="Atendimento">
                  {r.notaAtendimento === null ? <span className="p-muted">sem dados</span> : (
                    <span className="p-row" style={{ gap: 8 }}>
                      <span className="p-meter" style={{ width: 70 }}><span style={{ width: `${r.notaAtendimento}%` }} /></span>
                      <strong style={{ fontWeight: 500, color: corNota(r.notaAtendimento) }}>{r.notaAtendimento}</strong>
                    </span>
                  )}
                </td>
                <td data-rotulo="Lembretes">{r.lembretesPendentes}{r.lembretesAtrasados ? <span className="p-small" style={{ color: 'var(--p-danger)' }}> · {r.lembretesAtrasados} atrasado(s)</span> : null}</td>
                <td data-rotulo="Última atividade" className="p-muted">{tempoRelativo(r.ultimaAtividade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={{ marginBottom: 16 }}>
        <RelatorioEquipe inicial={relatorio} iaDemo={!iaDisponivel()} />
      </div>

      <div className="p-grid p-grid-3" style={{ marginBottom: 16, alignItems: 'start' }}>
        <section className="p-card">
          <div className="p-card-head"><h2>Funil da imobiliária</h2></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {ESTAGIOS.map((e) => (
              <div key={e} className="p-row" style={{ gap: 10 }}>
                <span className="p-small" style={{ width: 130 }}>{ROTULO_ESTAGIO[e]}</span>
                <div className="p-meter" style={{ flex: 1 }}><span style={{ width: `${(visao.funil[e] / maxFunil) * 100}%` }} /></div>
                <strong style={{ fontWeight: 500, width: 28, textAlign: 'right' }}>{visao.funil[e]}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="p-card">
          <div className="p-card-head"><h2>Pontos fortes recorrentes</h2></div>
          {(selecionado?.pontosFortes ?? visao.pontosFortes).length === 0 ? <p className="p-muted">Sem análises suficientes.</p> : (
            <ul className="p-bullets">{(selecionado?.pontosFortes ?? visao.pontosFortes).map((f) => <li key={f.texto}>{f.texto} <span className="p-muted p-small">({f.vezes}x)</span></li>)}</ul>
          )}
        </section>
        <section className="p-card">
          <div className="p-card-head"><h2>O que mais falta perguntar</h2></div>
          {(selecionado?.faltou ?? visao.faltou).length === 0 ? <p className="p-muted">Sem análises suficientes.</p> : (
            <ul className="p-bullets">{(selecionado?.faltou ?? visao.faltou).map((f) => <li key={f.texto}>{f.texto} <span className="p-muted p-small">({f.vezes}x)</span></li>)}</ul>
          )}
        </section>
      </div>

      {visao.alertas.length > 0 && !selecionado && (
        <section className="p-card" style={{ marginBottom: 16 }}>
          <div className="p-card-head"><h2>Alertas</h2></div>
          <ul className="p-list">
            {visao.alertas.map((a, i) => (
              <li key={i} className="p-row" style={{ gap: 8 }}>
                <span className={`p-badge ${a.tipo === 'quente_parado' || a.tipo === 'lembrete_atrasado' ? 'p-badge-danger' : 'p-badge-warn'}`}>{a.corretor}</span>
                {a.cliente_id ? <Link href={`/painel/clientes/${a.cliente_id}`}>{a.texto}</Link> : <span>{a.texto}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="p-grid p-grid-2" style={{ alignItems: 'start' }}>
        <section className="p-card">
          <div className="p-card-head"><h2>Atendimentos recentes{selecionado ? ` de ${selecionado.corretor.nome}` : ''}</h2></div>
          {analises.length === 0 ? <p className="p-muted">Nenhuma análise registrada.</p> : (
            <ul className="p-list">
              {analises.map((a) => (
                <li key={a.id}>
                  <Link href={`/painel/analises/${a.id}`} style={{ display: 'block' }}>
                    <div className="p-row p-between">
                      <span><strong style={{ fontWeight: 500 }}>{a.cliente_nome}</strong> <span className="p-muted p-small">· {a.corretor_nome} · {formatarData(a.criado_em, false)}</span></span>
                      <span className="p-row" style={{ gap: 6 }}>
                        <span className={`p-badge p-badge-${a.resultado.temperatura.nivel}`}>{ROTULO_TEMPERATURA[a.resultado.temperatura.nivel]} {a.resultado.temperatura.nota}</span>
                        <span className="p-badge p-badge-neutro" title="Nota do atendimento">at. {a.resultado.qualidade_atendimento?.nota ?? '--'}</span>
                      </span>
                    </div>
                    <p className="p-small p-muted" style={{ margin: '4px 0 0' }}>{a.resultado.resumo.length > 180 ? `${a.resultado.resumo.slice(0, 180)}...` : a.resultado.resumo}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="p-card">
          <div className="p-card-head"><h2>Clientes{selecionado ? ` de ${selecionado.corretor.nome}` : ' da equipe'}</h2><span className="p-small p-muted">{clientes.length} de {selecionado ? selecionado.clientes : t.clientes}</span></div>
          <div style={{ overflowX: 'auto' }}>
          <table className="p-table">
            <thead><tr><th>Cliente</th><th>Corretor</th><th>Temperatura</th><th>Estágio</th><th>Última interação</th></tr></thead>
            <tbody>
              {clientes.map((c) => (
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
                  <td data-rotulo="Corretor">{c.corretor_nome}</td>
                  <td data-rotulo="Temperatura"><TemperaturaBadge nivel={c.temperatura} nota={c.nota_temperatura} /></td>
                  <td data-rotulo="Estágio"><EstagioBadge estagio={c.estagio} /></td>
                  <td data-rotulo="Última interação" className="p-muted">{tempoRelativo(c.ultima_interacao)}</td>
                </tr>
              ))}
              {clientes.length === 0 && <tr><td colSpan={5} className="p-muted" style={{ textAlign: 'center', padding: 20 }}>Nenhum cliente.</td></tr>}
            </tbody>
          </table>
          </div>
        </section>
      </div>
    </>
  )
}
