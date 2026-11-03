'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Analise, AnaliseResultado } from '@/lib/painel/tipos'
import { ROTULO_ESTAGIO, ROTULO_TEMPERATURA } from '@/lib/painel/tipos'
import { formatarData, formatarUsd } from '@/lib/painel/formato'
import CopiarBotao from './CopiarBotao'

const ROTULO_INSIGHT: Record<string, string> = {
  urgencia: 'Urgência',
  hesitacao: 'Hesitação',
  concorrencia: 'Concorrência',
  decisor_ausente: 'Decisor ausente',
  risco_perda: 'Risco de perda',
  oportunidade: 'Oportunidade',
  outro: 'Sinal',
}

type Props = {
  analise: Pick<Analise, 'id' | 'resultado' | 'modelo' | 'tokens_entrada' | 'tokens_saida' | 'custo_usd' | 'demo' | 'criado_em' | 'cliente_id'>
  clienteNome?: string | null
  envioJetimob?: boolean
  // lembretes já criados a partir desta análise (título + data) para não duplicar
  lembretesCriados?: { titulo: string; data: string }[]
}

function fatosComoTexto(r: AnaliseResultado): string {
  const f = r.fatos
  const linhas = [
    ['Orçamento', f.orcamento],
    ['Forma de pagamento', f.forma_pagamento],
    ['Prazo', f.prazo],
    ['Composição familiar', f.composicao_familiar],
    ['Região desejada', f.regiao_desejada],
    ['Tipo de imóvel', f.tipo_imovel],
    ['Imóveis citados', f.imoveis_citados.join(', ') || null],
    ['Objeções', f.objecoes.join('; ') || null],
    ['Preferências', f.preferencias.join('; ') || null],
    ['Contato', [f.contato.nome, f.contato.telefone, f.contato.email].filter(Boolean).join(' / ') || null],
  ].filter(([, v]) => v)
  return linhas.map(([k, v]) => `${k}: ${v}`).join('\n')
}

export default function AnaliseResultadoView({ analise, clienteNome, envioJetimob = false, lembretesCriados = [] }: Props) {
  const r = analise.resultado
  const [criados, setCriados] = useState<Set<string>>(new Set(lembretesCriados.map((l) => `${l.titulo}|${l.data}`)))
  const [erro, setErro] = useState<string | null>(null)
  const [jetimob, setJetimob] = useState<'parado' | 'enviando' | 'ok' | 'erro'>('parado')

  async function criarLembrete(l: AnaliseResultado['lembretes'][number]) {
    setErro(null)
    const res = await fetch('/api/painel/lembretes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        titulo: l.titulo,
        data: l.data,
        descricao: l.trecho ? `Trecho: "${l.trecho}"` : null,
        cliente_id: analise.cliente_id,
        analise_id: analise.id,
        origem: 'ia',
      }),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setErro(b.error ?? 'Não foi possível criar o lembrete')
      return
    }
    setCriados((s) => new Set(s).add(`${l.titulo}|${l.data}`))
  }

  async function criarTodos() {
    for (const l of r.lembretes) if (!criados.has(`${l.titulo}|${l.data}`)) await criarLembrete(l)
  }

  async function enviarJetimob() {
    setJetimob('enviando')
    const res = await fetch('/api/painel/jetimob/enviar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ analise_id: analise.id }),
    })
    if (res.ok) setJetimob('ok')
    else {
      setJetimob('erro')
      const b = await res.json().catch(() => ({}))
      setErro(b.error ?? 'Falha ao enviar ao Jetimob')
    }
  }

  const tudo = [
    `RESUMO\n${r.resumo}`,
    `TEMPERATURA: ${ROTULO_TEMPERATURA[r.temperatura.nivel]} (${r.temperatura.nota}/100)\n${r.temperatura.justificativa}`,
    `ESTÁGIO: ${ROTULO_ESTAGIO[r.estagio]}`,
    `FATOS\n${fatosComoTexto(r)}`,
    `INSIGHTS\n${r.insights.map((i) => `- [${ROTULO_INSIGHT[i.tipo]}] ${i.descricao}`).join('\n')}`,
    `PRÓXIMA MENSAGEM (curta)\n${r.proxima_mensagem.curta}\n\nPRÓXIMA MENSAGEM (longa)\n${r.proxima_mensagem.longa}`,
    `NOTA PARA O JETIMOB\n${r.texto_jetimob}`,
    `LEMBRETES\n${r.lembretes.map((l) => `- ${formatarData(l.data)}: ${l.titulo}`).join('\n')}`,
    `PERGUNTAS EM ABERTO\n${r.perguntas_abertas.map((p) => `- ${p}`).join('\n')}`,
    `PRÓXIMOS PASSOS\n${r.proximos_passos.map((p) => `- ${p}`).join('\n')}`,
  ].join('\n\n')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="p-row p-between">
        <div className="p-row">
          <span className={`p-badge p-badge-${r.temperatura.nivel}`} style={{ fontSize: 14, padding: '6px 14px' }}>
            {ROTULO_TEMPERATURA[r.temperatura.nivel]} · {r.temperatura.nota}/100
          </span>
          <span className="p-badge p-badge-neutro">{ROTULO_ESTAGIO[r.estagio]}</span>
          {analise.demo && <span className="p-badge p-badge-demo">Exemplo (demo)</span>}
        </div>
        <div className="p-row">
          <CopiarBotao texto={tudo} rotulo="Copiar análise completa" />
          {clienteNome && (
            <Link href={`/painel/clientes/${analise.cliente_id}`} className="p-btn p-btn-sm">
              Ver cliente: {clienteNome}
            </Link>
          )}
        </div>
      </div>

      {erro && <div className="p-alert p-alert-danger">{erro}</div>}

      <div className="p-grid p-grid-2">
        <section className="p-card">
          <div className="p-card-head">
            <h3>Resumo executivo</h3>
            <CopiarBotao texto={r.resumo} />
          </div>
          <p className="p-pre">{r.resumo}</p>
        </section>

        <section className="p-card">
          <div className="p-card-head">
            <h3>Temperatura do lead</h3>
            <CopiarBotao texto={`${ROTULO_TEMPERATURA[r.temperatura.nivel]} (${r.temperatura.nota}/100). ${r.temperatura.justificativa}`} />
          </div>
          <div className="p-meter" style={{ marginBottom: 10 }}>
            <span style={{ width: `${r.temperatura.nota}%` }} />
          </div>
          <p className="p-pre">{r.temperatura.justificativa}</p>
        </section>
      </div>

      <section className="p-card">
        <div className="p-card-head">
          <h3>Fatos importantes</h3>
          <CopiarBotao texto={fatosComoTexto(r)} />
        </div>
        <div className="p-grid p-grid-3" style={{ gap: 10 }}>
          <Fato rotulo="Orçamento" valor={r.fatos.orcamento} />
          <Fato rotulo="Forma de pagamento" valor={r.fatos.forma_pagamento} />
          <Fato rotulo="Prazo" valor={r.fatos.prazo} />
          <Fato rotulo="Composição familiar" valor={r.fatos.composicao_familiar} />
          <Fato rotulo="Região desejada" valor={r.fatos.regiao_desejada} />
          <Fato rotulo="Tipo de imóvel" valor={r.fatos.tipo_imovel} />
          <Fato rotulo="Imóveis citados" valor={r.fatos.imoveis_citados.length ? r.fatos.imoveis_citados.map((c) => (
            <Link key={c} href={`/imovel/${c}`} target="_blank" className="p-badge p-badge-neutro" style={{ marginRight: 6 }}>{c}</Link>
          )) : null} />
          <Fato rotulo="Contato" valor={[r.fatos.contato.nome, r.fatos.contato.telefone, r.fatos.contato.email].filter(Boolean).join(' · ') || null} />
          <Fato rotulo="Objeções" valor={r.fatos.objecoes.length ? <ul className="p-bullets">{r.fatos.objecoes.map((o, i) => <li key={i}>{o}</li>)}</ul> : null} />
          <Fato rotulo="Preferências" valor={r.fatos.preferencias.length ? <ul className="p-bullets">{r.fatos.preferencias.map((o, i) => <li key={i}>{o}</li>)}</ul> : null} />
        </div>
      </section>

      <section className="p-card">
        <div className="p-card-head">
          <h3>Insights e sinais</h3>
          <CopiarBotao texto={r.insights.map((i) => `[${ROTULO_INSIGHT[i.tipo]}] ${i.descricao}`).join('\n')} />
        </div>
        {r.insights.length === 0 ? (
          <p className="p-muted">Nenhum sinal relevante além do que já está nos fatos.</p>
        ) : (
          <ul className="p-list">
            {r.insights.map((i, idx) => (
              <li key={idx}>
                <span className={`p-badge ${i.tipo === 'risco_perda' || i.tipo === 'concorrencia' ? 'p-badge-danger' : i.tipo === 'oportunidade' || i.tipo === 'urgencia' ? 'p-badge-ok' : 'p-badge-warn'}`} style={{ marginRight: 8 }}>
                  {ROTULO_INSIGHT[i.tipo]}
                </span>
                {i.descricao}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="p-grid p-grid-2">
        <section className="p-card">
          <div className="p-card-head">
            <h3>Próxima mensagem (curta)</h3>
            <CopiarBotao texto={r.proxima_mensagem.curta} />
          </div>
          <p className="p-pre">{r.proxima_mensagem.curta}</p>
        </section>
        <section className="p-card">
          <div className="p-card-head">
            <h3>Próxima mensagem (longa)</h3>
            <CopiarBotao texto={r.proxima_mensagem.longa} />
          </div>
          <p className="p-pre">{r.proxima_mensagem.longa}</p>
        </section>
      </div>

      <section className="p-card">
        <div className="p-card-head">
          <h3>Texto pronto para o Jetimob</h3>
          <div className="p-row">
            <CopiarBotao texto={r.texto_jetimob} />
            {envioJetimob && (
              <button type="button" className="p-btn p-btn-sm p-btn-navy" onClick={enviarJetimob} disabled={jetimob === 'enviando' || jetimob === 'ok'}>
                {jetimob === 'enviando' ? 'Enviando...' : jetimob === 'ok' ? 'Enviado ao Jetimob' : 'Enviar para o Jetimob'}
              </button>
            )}
          </div>
        </div>
        <p className="p-pre">{r.texto_jetimob}</p>
        {!envioJetimob && <p className="p-muted p-small" style={{ marginTop: 8 }}>Cole no histórico do lead no Jetimob. O envio automático depende de endpoint de anotação na API (ver docs/painel/jetimob-api.md).</p>}
      </section>

      <section className="p-card">
        <div className="p-card-head">
          <h3>Lembretes detectados</h3>
          {r.lembretes.length > 0 && (
            <button type="button" className="p-btn p-btn-sm" onClick={criarTodos} disabled={r.lembretes.every((l) => criados.has(`${l.titulo}|${l.data}`))}>
              Criar todos
            </button>
          )}
        </div>
        {r.lembretes.length === 0 ? (
          <p className="p-muted">Nenhuma tarefa com data foi encontrada na conversa.</p>
        ) : (
          <ul className="p-list">
            {r.lembretes.map((l, idx) => {
              const chave = `${l.titulo}|${l.data}`
              const feito = criados.has(chave)
              return (
                <li key={idx} className="p-row p-between">
                  <div>
                    <strong style={{ fontWeight: 500 }}>{l.titulo}</strong>
                    <div className="p-small p-muted">
                      {formatarData(l.data)} · confiança {l.confianca}
                      {l.trecho ? ` · "${l.trecho}"` : ''}
                    </div>
                  </div>
                  <button type="button" className={`p-btn p-btn-sm ${feito ? '' : 'p-btn-primary'}`} disabled={feito} onClick={() => criarLembrete(l)}>
                    {feito ? 'Lembrete criado' : 'Criar lembrete'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="p-grid p-grid-2">
        <section className="p-card">
          <div className="p-card-head">
            <h3>Perguntas em aberto</h3>
            <CopiarBotao texto={r.perguntas_abertas.join('\n')} />
          </div>
          <ul className="p-bullets">{r.perguntas_abertas.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </section>
        <section className="p-card">
          <div className="p-card-head">
            <h3>Próximos passos</h3>
            <CopiarBotao texto={r.proximos_passos.join('\n')} />
          </div>
          <ul className="p-bullets">{r.proximos_passos.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </section>
      </div>

      <section className="p-card">
        <div className="p-card-head">
          <h3>Qualidade do seu atendimento</h3>
          <span className={`p-badge ${r.qualidade_atendimento.nota >= 75 ? 'p-badge-ok' : r.qualidade_atendimento.nota >= 50 ? 'p-badge-warn' : 'p-badge-danger'}`}>
            {r.qualidade_atendimento.nota}/100
          </span>
        </div>
        <div className="p-grid p-grid-2">
          <div>
            <div className="p-label" style={{ marginBottom: 6 }}>Pontos fortes</div>
            <ul className="p-bullets">{r.qualidade_atendimento.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
          <div>
            <div className="p-label" style={{ marginBottom: 6 }}>Faltou perguntar</div>
            <ul className="p-bullets">{r.qualidade_atendimento.faltou_perguntar.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        </div>
        {r.qualidade_atendimento.observacoes && <p className="p-muted" style={{ marginTop: 10 }}>{r.qualidade_atendimento.observacoes}</p>}
      </section>

      <p className="p-small p-muted">
        Modelo: {analise.modelo} · tokens: {analise.tokens_entrada.toLocaleString('pt-BR')} entrada / {analise.tokens_saida.toLocaleString('pt-BR')} saída · custo estimado {formatarUsd(analise.custo_usd)} · {formatarData(analise.criado_em)}
      </p>
    </div>
  )
}

function Fato({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--p-border)', borderRadius: 10, background: 'var(--p-surface-2)' }}>
      <div className="p-label" style={{ marginBottom: 4 }}>{rotulo}</div>
      <div style={{ lineHeight: 1.45 }}>{valor ?? <span className="p-muted">não informado</span>}</div>
    </div>
  )
}
