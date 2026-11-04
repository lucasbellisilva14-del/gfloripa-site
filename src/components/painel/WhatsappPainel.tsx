'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Analise, ChatWhatsapp, ComandoWhatsapp, EstadoWhatsapp, MensagemWhatsapp, Temperatura } from '@/lib/painel/tipos'
import { ROTULO_TEMPERATURA } from '@/lib/painel/tipos'
import type { SaudePonte } from '@/lib/painel/whatsapp-ponte'
import { ROTULO_SITUACAO, situacaoWhatsapp, type Situacao } from '@/lib/painel/whatsapp-situacao'
import { formatarData, formatarDataCurta, iniciais } from '@/lib/painel/formato'
import AnaliseResultadoView from './AnaliseResultadoView'

type ResumoCliente = { nome: string; temperatura: string | null; nota: number | null; estagio: string | null }

type Props = {
  estadoInicial: EstadoWhatsapp | null
  chatsIniciais: ChatWhatsapp[]
  clientesIniciais: Record<string, ResumoCliente>
  pontePronta: boolean
  diretoConfigurado: boolean
  hospedagemUrl: string | null
  envioJetimob: boolean
}

type Resposta = {
  analise: Analise & { cliente_nome: string }
  avisos: string[]
  demo: boolean
  mensagens_analisadas: number
}

const novasDe = (c: ChatWhatsapp) => Math.max(0, c.total_mensagens - (c.mensagens_analisadas ?? 0))

export default function WhatsappPainel(p: Props) {
  const [estado, setEstado] = useState(p.estadoInicial)
  const [saude, setSaude] = useState<SaudePonte | null>(null)
  const [chats, setChats] = useState(p.chatsIniciais)
  const [clientes, setClientes] = useState(p.clientesIniciais)
  const [agora, setAgora] = useState(0)
  const [origem, setOrigem] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Record<string, MensagemWhatsapp[]>>({})
  const [analisando, setAnalisando] = useState<string | null>(null)
  const [loteRestante, setLoteRestante] = useState(0)
  const [executando, setExecutando] = useState<ComandoWhatsapp | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const atualizar = useCallback(async () => {
    setAgora(Date.now())
    setOrigem(window.location.origin)
    try {
      const [rs, rc] = await Promise.all([
        fetch('/api/painel/whatsapp/saude', { cache: 'no-store' }),
        fetch('/api/painel/whatsapp/chat', { cache: 'no-store' }),
      ])
      if (rs.ok) {
        const b = await rs.json()
        setEstado(b.estado ?? null)
        setSaude(b.saude ?? null)
      }
      if (rc.ok) {
        const b = await rc.json()
        setChats(b.chats ?? [])
        setClientes(b.clientes ?? {})
      }
    } catch {
      // rede instável: tenta no próximo ciclo
    }
  }, [])

  const { situacao, verificacoes, msSemPulso } = useMemo(
    () => situacaoWhatsapp({ estado, saude, pontePronta: p.pontePronta, agoraMs: agora, origemPainel: origem }),
    [estado, saude, p.pontePronta, agora, origem]
  )

  // Primeira atualização logo ao montar; depois, enquanto não está estável,
  // a cada 4 s (o QR expira rápido e os comandos precisam refletir logo), e
  // conectado a cada 15 s. Tudo dentro do mesmo temporizador, para a
  // atualização nunca rodar de forma síncrona no corpo do efeito.
  useEffect(() => {
    const intervalo = situacao === 'conectado' ? 15000 : 4000
    const ciclo = (atraso: number) => {
      timer.current = setTimeout(async () => {
        await atualizar()
        ciclo(intervalo)
      }, atraso)
    }
    ciclo(agora === 0 ? 0 : intervalo)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // agora só importa para disparar a primeira rodada sem espera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao, atualizar])

  async function comandar(comando: ComandoWhatsapp) {
    if (comando === 'parear_novamente' && !window.confirm('Isso desconecta o WhatsApp atual e pede um código QR novo. Continuar?')) return
    setErro(null)
    setAviso(null)
    setExecutando(comando)
    try {
      const res = await fetch('/api/painel/whatsapp/comando', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comando }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(b.error ?? `Erro ${res.status}`)
        return
      }
      const nomes: Record<ComandoWhatsapp, string> = { pulso: 'Verificação', reconectar: 'Reconexão', parear_novamente: 'Novo pareamento' }
      if (b.via === 'direto') setAviso(`${nomes[comando]} enviada ao serviço. Atualizando...`)
      else if (situacao === 'servico_fora' || situacao === 'sem_noticias') {
        setAviso(`${nomes[comando]} deixada na fila, mas o serviço não está respondendo: ele só vai executar quando voltar. Se não voltar sozinho, reinicie na hospedagem.`)
      } else setAviso(`${nomes[comando]} deixada na fila. O serviço pega em até 5 segundos.`)
      setTimeout(atualizar, 2500)
      setTimeout(atualizar, 7000)
    } catch {
      setErro('Falha de rede ao enviar o comando.')
    } finally {
      setExecutando(null)
    }
  }

  async function abrirConversa(chat: ChatWhatsapp) {
    if (aberto === chat.id) {
      setAberto(null)
      return
    }
    setAberto(chat.id)
    const res = await fetch(`/api/painel/whatsapp/chat/${chat.id}/mensagens?limite=200`, { cache: 'no-store' })
    if (res.ok) {
      const b = await res.json()
      setMensagens((m) => ({ ...m, [chat.id]: b.mensagens ?? [] }))
    }
  }

  async function analisar(chat: ChatWhatsapp): Promise<boolean> {
    setErro(null)
    setAnalisando(chat.id)
    try {
      const res = await fetch('/api/painel/whatsapp/analisar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chat.id }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(`${chat.nome || chat.telefone}: ${b.error ?? `erro ${res.status}`}`)
        return false
      }
      setResposta(b as Resposta)
      return true
    } catch {
      setErro('Falha de rede ao analisar a conversa.')
      return false
    } finally {
      setAnalisando(null)
    }
  }

  async function analisarUma(chat: ChatWhatsapp) {
    setResposta(null)
    const ok = await analisar(chat)
    await atualizar()
    if (ok) setTimeout(() => document.getElementById('resultado-wa')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function analisarTodasComNovidades() {
    const alvo = chats.filter((c) => novasDe(c) > 0 && c.total_mensagens >= 2)
    if (!alvo.length) return
    if (!window.confirm(`Analisar ${alvo.length} conversa(s) com mensagens novas? Cada uma custa alguns centavos de dólar.`)) return
    setResposta(null)
    setLoteRestante(alvo.length)
    for (const c of alvo) {
      await analisar(c)
      setLoteRestante((n) => n - 1)
    }
    await atualizar()
    setAviso(`${alvo.length} conversa(s) analisada(s). As fichas dos clientes estão atualizadas.`)
  }

  async function arquivar(chat: ChatWhatsapp) {
    await fetch('/api/painel/whatsapp/chat', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat.id, arquivado: true }),
    })
    if (aberto === chat.id) setAberto(null)
    await atualizar()
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return chats
    return chats.filter((c) => [c.nome, c.telefone, c.ultimo_texto, clientes[c.id]?.nome].some((v) => (v ?? '').toLowerCase().includes(q)))
  }, [chats, busca, clientes])

  const comNovidades = chats.filter((c) => novasDe(c) > 0 && c.total_mensagens >= 2).length
  const ocupado = executando !== null || analisando !== null || loteRestante > 0
  const d = estado?.diagnostico ?? null

  const classeSituacao: Record<Situacao, string> = {
    conectado: 'p-badge-ok',
    aguardando_qr: 'p-badge-warn',
    conectando: 'p-badge-warn',
    desconectado: 'p-badge-danger',
    servico_fora: 'p-badge-danger',
    sem_noticias: 'p-badge-danger',
    nao_configurado: 'p-badge-neutro',
  }
  const servicoNaoResponde = situacao === 'servico_fora' || situacao === 'sem_noticias'

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ---------------- Conexão ---------------- */}
      <section className="p-card">
        <div className="p-card-head">
          <h2>Conexão</h2>
          <span className={`p-badge ${classeSituacao[situacao]}`} style={{ fontSize: 13, padding: '5px 12px' }}>
            {ROTULO_SITUACAO[situacao]}
          </span>
        </div>

        {situacao === 'nao_configurado' && (
          <div className="p-alert p-alert-warn">
            A ponte ainda não foi configurada. Falta a variável <code>PAINEL_WHATSAPP_TOKEN</code> na Vercel e no serviço. O passo a passo está em <code>docs/painel/whatsapp.md</code>.
          </div>
        )}

        {situacao !== 'nao_configurado' && (
          <>
            {situacao === 'aguardando_qr' && estado?.qr && (
              <div className="p-row" style={{ alignItems: 'flex-start', gap: 20, marginBottom: 14 }}>
                <Image src={estado.qr} alt="Código QR para conectar o WhatsApp" width={240} height={240} unoptimized style={{ background: '#fff', padding: 10, borderRadius: 12 }} />
                <div style={{ maxWidth: 420 }}>
                  <h3>Conecte o seu WhatsApp</h3>
                  <ol className="p-bullets" style={{ paddingLeft: 20 }}>
                    <li>Abra o WhatsApp no celular.</li>
                    <li>Toque nos três pontinhos e escolha Aparelhos conectados.</li>
                    <li>Toque em Conectar um aparelho e aponte a câmera para este código.</li>
                  </ol>
                  <p className="p-small p-muted">O código expira em cerca de um minuto e esta tela busca um novo sozinha.</p>
                </div>
              </div>
            )}

            {servicoNaoResponde && (
              <div className="p-alert p-alert-danger" style={{ marginBottom: 12 }}>
                <strong>O serviço não está respondendo</strong>
                {msSemPulso !== null && situacao === 'sem_noticias' ? ` há ${Math.round(msSemPulso / 60000)} minuto(s)` : ''}.
                {' '}Os botões abaixo deixam o pedido na fila, mas ele só executa quando o serviço voltar. Se não voltar sozinho em
                um minuto, reinicie na hospedagem{p.hospedagemUrl ? <> (<a href={p.hospedagemUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>abrir</a>)</> : ''} e veja os registros: a causa costuma estar na última linha.
              </div>
            )}

            {situacao === 'conectado' && (
              <p className="p-muted" style={{ marginBottom: 12 }}>
                Conectado{estado?.numero ? ` ao número ${estado.numero}` : ''}. As conversas aparecem abaixo conforme chegam.
                O painel apenas lê: nenhuma mensagem é enviada por aqui, você responde pelo WhatsApp normal.
              </p>
            )}

            <div className="p-row" style={{ gap: 8, marginBottom: 12 }}>
              <button type="button" className="p-btn p-btn-sm" disabled={ocupado} onClick={() => comandar('pulso')}>
                {executando === 'pulso' ? 'Verificando...' : 'Verificar agora'}
              </button>
              <button type="button" className="p-btn p-btn-sm p-btn-navy" disabled={ocupado} onClick={() => comandar('reconectar')}>
                {executando === 'reconectar' ? 'Pedindo...' : 'Reconectar'}
              </button>
              <button type="button" className="p-btn p-btn-sm" disabled={ocupado} onClick={() => comandar('parear_novamente')}>
                {executando === 'parear_novamente' ? 'Pedindo...' : 'Parear de novo (novo QR)'}
              </button>
              {!p.diretoConfigurado && (
                <span className="p-small p-muted">
                  Comandos vão pela fila (até 5 s). Para resposta imediata e saúde em tempo real, configure <code>WHATSAPP_PONTE_URL</code>.
                </span>
              )}
            </div>

            {aviso && <div className="p-alert p-alert-info" style={{ marginBottom: 12 }}>{aviso}</div>}

            <ul className="p-checks">
              {verificacoes.map((v) => (
                <li key={v.chave}>
                  <span className={v.ok === true ? 'p-check-ok' : v.ok === false ? 'p-check-nao' : 'p-check-talvez'}>
                    {v.ok === true ? '✓' : v.ok === false ? '!' : '?'}
                  </span>
                  <span>
                    {v.rotulo}
                    <small>{v.detalhe}</small>
                  </span>
                </li>
              ))}
            </ul>

            <p className="p-small p-muted" style={{ marginTop: 10 }}>
              {estado?.atualizado_em ? `Última notícia do serviço: ${formatarData(estado.atualizado_em)}` : 'Nenhuma notícia do serviço ainda.'}
              {d?.versao ? ` · versão ${d.versao}` : ''}
              {estado?.detalhe ? ` · ${estado.detalhe}` : ''}
            </p>
          </>
        )}
      </section>

      {erro && <div className="p-alert p-alert-danger">{erro}</div>}

      {/* ---------------- Conversas ---------------- */}
      <section className="p-card">
        <div className="p-card-head" style={{ flexWrap: 'wrap' }}>
          <h2>Conversas capturadas <span className="p-badge p-badge-neutro" style={{ marginLeft: 6 }}>{chats.length}</span></h2>
          <div className="p-row" style={{ gap: 8 }}>
            <input className="p-input" style={{ width: 240, padding: '7px 10px' }} placeholder="Buscar nome, telefone, texto" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button type="button" className="p-btn p-btn-sm p-btn-primary" disabled={ocupado || comNovidades === 0} onClick={analisarTodasComNovidades}>
              {loteRestante > 0 ? `Analisando... faltam ${loteRestante}` : `Analisar todas com novidades (${comNovidades})`}
            </button>
          </div>
        </div>

        {chats.length === 0 ? (
          <p className="p-muted">
            Nenhuma conversa ainda. Depois de conectar, cada mensagem nova que chegar ou que você enviar pelo celular aparece
            aqui. Só entram mensagens dos últimos 7 dias.
          </p>
        ) : filtrados.length === 0 ? (
          <p className="p-muted">Nada encontrado para &quot;{busca}&quot;.</p>
        ) : (
          <ul className="p-list">
            {filtrados.map((c) => {
              const cli = clientes[c.id]
              const novas = novasDe(c)
              const estaAberto = aberto === c.id
              const msgs = mensagens[c.id]
              return (
                <li key={c.id} style={{ display: 'grid', gap: 10 }}>
                  <div className="p-row p-between" style={{ gap: 12 }}>
                    <button type="button" onClick={() => abrirConversa(c)} className="p-row" style={{ gap: 10, minWidth: 0, flex: 1, background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                      <span className="p-avatar">{iniciais(c.nome || c.telefone || '?')}</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span className="p-row" style={{ gap: 6 }}>
                          <strong style={{ fontWeight: 500 }}>{c.nome || c.telefone || 'Sem nome'}</strong>
                          {cli?.temperatura && (
                            <span className={`p-badge p-badge-${cli.temperatura}`}>{ROTULO_TEMPERATURA[cli.temperatura as Temperatura]}{cli.nota != null ? ` · ${cli.nota}` : ''}</span>
                          )}
                          {novas > 0 && <span className="p-novas">{novas} nova{novas > 1 ? 's' : ''}</span>}
                        </span>
                        <span className="p-small p-muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.total_mensagens} mensagens · {formatarDataCurta(c.ultima_mensagem_em)}
                          {c.ultimo_texto ? ` · ${c.ultimo_texto}` : ''}
                        </span>
                      </span>
                    </button>
                    <div className="p-row" style={{ gap: 6, flexShrink: 0 }}>
                      <button type="button" className="p-btn p-btn-sm" onClick={() => abrirConversa(c)}>{estaAberto ? 'Fechar' : 'Ler'}</button>
                      <button type="button" className="p-btn p-btn-sm p-btn-primary" disabled={ocupado || c.total_mensagens < 2} onClick={() => analisarUma(c)}>
                        {analisando === c.id ? 'Analisando...' : novas > 0 && c.analisado_em ? 'Reanalisar' : 'Analisar'}
                      </button>
                      {c.cliente_id && <Link href={`/painel/clientes/${c.cliente_id}`} className="p-btn p-btn-sm">Ficha</Link>}
                      <button type="button" className="p-btn p-btn-sm p-btn-ghost" onClick={() => arquivar(c)}>Arquivar</button>
                    </div>
                  </div>

                  {estaAberto && (
                    <div>
                      {!msgs ? (
                        <p className="p-small p-muted">Carregando conversa...</p>
                      ) : msgs.length === 0 ? (
                        <p className="p-small p-muted">Sem mensagens guardadas.</p>
                      ) : (
                        <div className="p-conversa">
                          {msgs.map((m) => (
                            <div key={m.id} className={`p-bolha ${m.direcao === 'saida' ? 'p-bolha-saida' : ''}`}>
                              {m.texto}
                              <small>{m.direcao === 'saida' ? 'você' : (m.autor || c.nome || 'cliente')} · {formatarData(m.data)}</small>
                            </div>
                          ))}
                        </div>
                      )}
                      {c.analisado_em && (
                        <p className="p-small p-muted" style={{ marginTop: 6 }}>
                          Última análise em {formatarData(c.analisado_em)}, com {c.mensagens_analisadas} mensagens.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ---------------- Resultado ---------------- */}
      {resposta && (
        <div id="resultado-wa" style={{ display: 'grid', gap: 14 }}>
          <h2>Análise de {resposta.analise.cliente_nome}</h2>
          <p className="p-small p-muted">{resposta.mensagens_analisadas} mensagens analisadas.</p>
          {resposta.avisos.length > 0 && (
            <div className={`p-alert ${resposta.demo ? 'p-alert-warn' : 'p-alert-info'}`}>
              <ul className="p-bullets">{resposta.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          <AnaliseResultadoView analise={resposta.analise} clienteNome={resposta.analise.cliente_nome} envioJetimob={p.envioJetimob} />
        </div>
      )}
    </div>
  )
}
