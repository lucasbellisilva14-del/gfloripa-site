import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { imoveisPorCodigos, jetimobConfigurado } from '@/lib/painel/imoveis'
import { TemperaturaBadge, EstagioBadge, TipoBadge } from '@/components/painel/Badges'
import LembreteAcoes from '@/components/painel/LembreteAcoes'
import NovoLembreteForm from '@/components/painel/NovoLembreteForm'
import CopiarBotao from '@/components/painel/CopiarBotao'
import { classificarLembrete, formatarData, formatarDataCurta, iniciais } from '@/lib/painel/formato'
import { ROTULO_TEMPERATURA } from '@/lib/painel/tipos'
import { formatPrice } from '@/lib/jetimob'

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const corretor = (await getCorretorLogado())!
  const db = await getDb()
  const cliente = await db.obterCliente(id)
  if (!cliente || cliente.corretor_id !== corretor.id) notFound()

  const [conversas, analises, lembretes, interesses] = await Promise.all([
    db.listarConversasDoCliente(id),
    db.listarAnalisesDoCliente(id),
    db.listarLembretes({ corretor_id: corretor.id, cliente_id: id }),
    db.listarImoveisInteresse(id),
  ])
  const imoveis = await imoveisPorCodigos(interesses.map((i) => i.codigo_imovel))
  const ultima = analises[0]?.resultado ?? null
  const evolucao = [...analises].reverse()

  return (
    <>
      <div className="p-head">
        <div className="p-row" style={{ gap: 14 }}>
          <span className="p-avatar" style={{ width: 52, height: 52, fontSize: 18, flexBasis: 52 }}>{iniciais(cliente.nome)}</span>
          <div>
            <h1>{cliente.nome}</h1>
            <p className="p-row" style={{ gap: 8 }}>
              <TipoBadge tipo={cliente.tipo} />
              <TemperaturaBadge nivel={cliente.temperatura} nota={cliente.nota_temperatura} />
              <EstagioBadge estagio={cliente.estagio} />
              <span className="p-small">{cliente.telefone ?? 'sem telefone'}{cliente.email ? ` · ${cliente.email}` : ''}{cliente.origem ? ` · origem: ${cliente.origem}` : ''}</span>
            </p>
          </div>
        </div>
        <div className="p-row">
          {cliente.telefone && (
            <a className="p-btn" href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '').replace(/^55/, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          )}
          <Link href="/painel/analisar" className="p-btn p-btn-primary">Analisar nova conversa</Link>
        </div>
      </div>

      <div className="p-grid p-grid-2" style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="p-card">
            <div className="p-card-head">
              <h2>Fatos consolidados</h2>
              {ultima && <CopiarBotao texto={ultima.texto_jetimob} rotulo="Copiar nota Jetimob" />}
            </div>
            {!ultima ? (
              <p className="p-muted">{cliente.resumo ?? 'Sem análise ainda. Analise uma conversa para preencher o perfil.'}</p>
            ) : (
              <>
                <p className="p-pre" style={{ marginBottom: 12 }}>{ultima.resumo}</p>
                <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: 0, fontSize: 14.5 }}>
                  {[
                    ['Orçamento', ultima.fatos.orcamento],
                    ['Pagamento', ultima.fatos.forma_pagamento],
                    ['Prazo', ultima.fatos.prazo],
                    ['Família', ultima.fatos.composicao_familiar],
                    ['Região', ultima.fatos.regiao_desejada],
                    ['Imóvel', ultima.fatos.tipo_imovel],
                    ['Objeções', ultima.fatos.objecoes.join('; ') || null],
                    ['Preferências', ultima.fatos.preferencias.join('; ') || null],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'contents' }}>
                        <dt className="p-muted">{k}</dt>
                        <dd style={{ margin: 0 }}>{v}</dd>
                      </div>
                    ))}
                </dl>
                {ultima.perguntas_abertas.length > 0 && (
                  <>
                    <hr className="p-divider" />
                    <div className="p-label" style={{ marginBottom: 6 }}>Perguntas em aberto</div>
                    <ul className="p-bullets">{ultima.perguntas_abertas.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
              </>
            )}
          </section>

          <section className="p-card">
            <div className="p-card-head"><h2>Evolução da temperatura</h2></div>
            {evolucao.length === 0 ? (
              <p className="p-muted">Sem análises.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {evolucao.map((a) => (
                  <div key={a.id} className="p-row" style={{ gap: 10 }}>
                    <span className="p-small p-muted" style={{ width: 92 }}>{formatarData(a.criado_em, false)}</span>
                    <div className="p-meter" style={{ flex: 1 }}><span style={{ width: `${a.resultado.temperatura.nota}%` }} /></div>
                    <span className={`p-badge p-badge-${a.resultado.temperatura.nivel}`}>{ROTULO_TEMPERATURA[a.resultado.temperatura.nivel]} {a.resultado.temperatura.nota}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="p-card">
            <div className="p-card-head"><h2>Imóveis de interesse</h2></div>
            {interesses.length === 0 ? (
              <p className="p-muted">Nenhum imóvel vinculado.</p>
            ) : (
              <ul className="p-list">
                {interesses.map((i) => {
                  const p = imoveis[i.codigo_imovel]
                  return (
                    <li key={i.id} className="p-row p-between">
                      <div>
                        <strong style={{ fontWeight: 500 }}>{i.codigo_imovel}</strong>
                        {p ? <span> · {p.titulo_anuncio} · {[p.endereco_bairro, p.endereco_cidade].filter(Boolean).join(', ')} · {formatPrice(p.valor_venda ?? p.valor_locacao ?? p.valor_temporada)}</span> : <span className="p-muted"> · {jetimobConfigurado() ? 'não encontrado no Jetimob' : 'dados do imóvel só com a chave do Jetimob'}</span>}
                        <div className="p-small p-muted">{i.origem === 'ia' ? 'citado na conversa' : 'adicionado manualmente'}</div>
                      </div>
                      <Link href={`/imovel/${i.codigo_imovel}`} target="_blank" className="p-btn p-btn-sm">Ver no site</Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="p-card">
            <div className="p-card-head"><h2>Lembretes</h2></div>
            <NovoLembreteForm clientes={[]} clienteId={id} />
            <hr className="p-divider" />
            {lembretes.length === 0 ? (
              <p className="p-muted">Nenhum lembrete.</p>
            ) : (
              <ul className="p-list">
                {lembretes.map((l) => {
                  const classe = classificarLembrete(l.data)
                  return (
                    <li key={l.id} className="p-row p-between" style={{ opacity: l.status === 'pendente' ? 1 : 0.6 }}>
                      <div>
                        <div className="p-row" style={{ gap: 8 }}>
                          <span className={`p-badge ${l.status !== 'pendente' ? 'p-badge-neutro' : classe === 'atrasado' ? 'p-badge-danger' : classe === 'hoje' ? 'p-badge-warn' : 'p-badge-neutro'}`}>{formatarDataCurta(l.data)}</span>
                          <strong style={{ fontWeight: 500, textDecoration: l.status === 'concluido' ? 'line-through' : undefined }}>{l.titulo}</strong>
                        </div>
                        {l.descricao && <div className="p-small p-muted">{l.descricao}</div>}
                      </div>
                      <LembreteAcoes id={l.id} status={l.status} />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="p-card">
            <div className="p-card-head"><h2>Linha do tempo</h2></div>
            {conversas.length === 0 ? (
              <p className="p-muted">Nenhuma conversa registrada.</p>
            ) : (
              <ul className="p-timeline">
                {conversas.map((c) => {
                  const a = analises.find((x) => x.conversa_id === c.id)
                  return (
                    <li key={c.id}>
                      <div className="p-small p-muted">{formatarData(c.data_conversa, false)} · {c.origem}{c.nome_arquivo ? ` · ${c.nome_arquivo}` : ''}</div>
                      {a ? (
                        <>
                          <div className="p-row" style={{ gap: 8, margin: '4px 0' }}>
                            <span className={`p-badge p-badge-${a.resultado.temperatura.nivel}`}>{ROTULO_TEMPERATURA[a.resultado.temperatura.nivel]} {a.resultado.temperatura.nota}</span>
                            <Link href={`/painel/analises/${a.id}`} className="p-btn p-btn-sm">Ver análise</Link>
                          </div>
                          <p className="p-small" style={{ margin: 0 }}>{a.resultado.resumo}</p>
                        </>
                      ) : (
                        <p className="p-small p-muted" style={{ margin: '4px 0 0' }}>{c.texto.slice(0, 200)}...</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
