'use client'

import { useState } from 'react'
import type { RelatorioGuardado } from '@/lib/painel/relatorio-equipe'
import { formatarData, formatarUsd } from '@/lib/painel/formato'

// Relatório da equipe gerado pela I.A.: mostra o último guardado e permite
// gerar outro. Só o gestor chega aqui.
export default function RelatorioEquipe({ inicial, iaDemo }: { inicial: RelatorioGuardado | null; iaDemo: boolean }) {
  const [guardado, setGuardado] = useState<RelatorioGuardado | null>(inicial)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function gerar() {
    setErro(null)
    setGerando(true)
    try {
      const res = await fetch('/api/painel/equipe/relatorio', { method: 'POST' })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.error ?? 'Não foi possível gerar o relatório')
        return
      }
      setGuardado(dados.relatorio)
    } finally {
      setGerando(false)
    }
  }

  const r = guardado?.relatorio
  const corNota = (n: number | null) => (n === null ? undefined : n >= 75 ? 'var(--p-ok, #2e9e5b)' : n >= 50 ? undefined : 'var(--p-danger)')

  return (
    <section className="p-card" data-teste="relatorio-equipe">
      <div className="p-card-head">
        <h2>Relatório da equipe pela I.A.</h2>
        <div className="p-row" style={{ gap: 8 }}>
          {guardado && <span className="p-small p-muted">gerado em {formatarData(guardado.gerado_em)} · {guardado.analises_consideradas} análises · {guardado.demo ? 'demo' : `${guardado.modelo} · ${formatarUsd(guardado.custo_usd)}`}</span>}
          <button type="button" className="p-btn p-btn-primary p-btn-sm" onClick={gerar} disabled={gerando}>
            {gerando ? 'Gerando...' : guardado ? 'Atualizar relatório' : 'Gerar relatório'}
          </button>
        </div>
      </div>
      {iaDemo && <div className="p-alert p-alert-info" style={{ marginBottom: 12 }}>Sem ANTHROPIC_API_KEY o relatório é montado só com os números. Com a chave, a I.A. lê as análises e escreve o diagnóstico.</div>}
      {erro && <div className="p-alert p-alert-danger">{erro}</div>}
      {!r ? (
        <p className="p-muted">Nenhum relatório ainda. Clique em Gerar relatório: a I.A. lê as análises recentes de cada corretor e devolve pontos fortes, pontos fracos, o que falta e prioridades.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="p-row" style={{ gap: 16, alignItems: 'start' }}>
            <div className="p-stat" style={{ minWidth: 120 }}>
              <small>Nota da equipe</small>
              <strong style={{ color: corNota(r.nota_equipe) }}>{r.nota_equipe}</strong>
              <span>de 100</span>
            </div>
            <p className="p-pre" style={{ margin: 0, flex: 1 }} data-teste="relatorio-resumo">{r.resumo_geral}</p>
          </div>

          <div className="p-grid p-grid-3">
            <Lista titulo="Pontos fortes" itens={r.pontos_fortes} vazio="Nada recorrente ainda." />
            <Lista titulo="Pontos fracos" itens={r.pontos_fracos} vazio="Nada recorrente ainda." />
            <Lista titulo="O que falta" itens={r.o_que_falta} vazio="Nada apontado." />
          </div>

          {r.prioridades.length > 0 && (
            <div>
              <div className="p-label" style={{ marginBottom: 6 }}>Prioridades para o gestor</div>
              <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 4 }}>
                {r.prioridades.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            </div>
          )}

          <div>
            <div className="p-label" style={{ marginBottom: 8 }}>Por corretor</div>
            <div className="p-grid p-grid-2">
              {r.por_corretor.map((p) => (
                <div key={`${p.corretor_id}-${p.nome}`} className="p-card" style={{ padding: 14 }}>
                  <div className="p-row p-between" style={{ marginBottom: 6 }}>
                    <strong>{p.nome}</strong>
                    <span className="p-badge p-badge-neutro" style={{ color: corNota(p.nota) }}>{p.nota === null ? 'sem nota' : `${p.nota}/100`}</span>
                  </div>
                  <p className="p-small" style={{ margin: '0 0 8px' }}>{p.resumo}</p>
                  {p.pontos_fortes.length > 0 && <Mini rotulo="Forte" itens={p.pontos_fortes} />}
                  {p.pontos_fracos.length > 0 && <Mini rotulo="Fraco" itens={p.pontos_fracos} />}
                  {p.recomendacoes.length > 0 && <Mini rotulo="Fazer" itens={p.recomendacoes} />}
                </div>
              ))}
            </div>
          </div>

          {r.clientes_em_risco.length > 0 && (
            <div>
              <div className="p-label" style={{ marginBottom: 6 }}>Clientes em risco</div>
              <ul className="p-list">
                {r.clientes_em_risco.map((c, i) => (
                  <li key={i}><strong style={{ fontWeight: 500 }}>{c.cliente}</strong> <span className="p-muted p-small">({c.corretor})</span> · {c.motivo}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Lista({ titulo, itens, vazio }: { titulo: string; itens: string[]; vazio: string }) {
  return (
    <div>
      <div className="p-label" style={{ marginBottom: 6 }}>{titulo}</div>
      {itens.length === 0 ? <p className="p-muted p-small" style={{ margin: 0 }}>{vazio}</p> : <ul className="p-bullets">{itens.map((t, i) => <li key={i}>{t}</li>)}</ul>}
    </div>
  )
}

function Mini({ rotulo, itens }: { rotulo: string; itens: string[] }) {
  return (
    <div className="p-small" style={{ marginBottom: 4 }}>
      <span className="p-muted">{rotulo}: </span>
      {itens.join('; ')}
    </div>
  )
}
