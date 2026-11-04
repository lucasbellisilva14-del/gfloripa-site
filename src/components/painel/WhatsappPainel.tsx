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
  urlDireta: string | null
  hospedagemUrl: string | null
  envioJetimob: boolean
}

type Resposta = {
  analise: Analise & { cliente_nome: string }
  avisos: string[]
  demo: boolean
  mensagens_analisadas: number
}

const NOMES_COMANDO: Record<ComandoWhatsapp, string> = {
  pulso: 'Verificação',
  reconectar: 'Reconexão',
  parear_novamente: 'Novo pareamento',
}

// Por quanto tempo, depois de um comando, a tela consulta a cada segundo.
const RAJADA_MS = 25_000

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
  // último comando enviado e quando: controla a rajada de consultas e o aviso
  // noticiaAntes: a última notícia do serviço no momento do pedido; um pulso é
  // dado por atendido quando chega uma notícia diferente dela (não depende de
  // comparar relógio do navegador com relógio do servidor)
  const [pedido, setPedido] = useState<{ comando: ComandoWhatsapp; em: number; via: 'direto' | 'fila'; noticiaAntes: string | null } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frescoAte = useRef(0)

  const atualizar = useCallback(async () => {
    const t = Date.now()
    setAgora(t)
    setOrigem(window.location.origin)
    const fresco = t < frescoAte.current ? '?fresco=1' : ''
    try {
      const [rs, rc] = await Promise.all([
        fetch(`/api/painel/whatsapp/saude${fresco}`, { cache: 'no-store' }),
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

  const leitura = useMemo(
    () => situacaoWhatsapp({ estado, saude, pontePronta: p.pontePronta, agoraMs: agora, origemPainel: origem, urlDireta: p.urlDireta }),
    [estado, saude, p.pontePronta, agora, origem, p.urlDireta]
  )
  const { situacao, verificacoes, servicoVivo, mostrarQr, desatualizado } = leitura

  // Um pedido é dado por atendido quando o efeito aparece (QR na tela, conexão
  // aberta, pulso novo). Isso é derivado do estado atual, não guardado: assim
  // a rajada e o aviso somem sozinhos, sem precisar de efeito para limpar.
  const pedidoAtivo = useMemo(() => {
    if (!pedido) return null
    const atendido =
      (pedido.comando === 'parear_novamente' && mostrarQr) ||
      (pedido.comando === 'reconectar' && situacao === 'conectado') ||
      (pedido.comando === 'pulso' && Boolean(estado?.atualizado_em) && estado!.atualizado_em !== pedido.noticiaAntes)
    return atendido ? null : pedido
  }, [pedido, mostrarQr, situacao, estado])

  // Ritmo das consultas: 1 s nos 25 s seguintes a um comando, 2 s enquanto a
  // conexão não está estável (QR, reconexão), 10 s quando conectado. Tudo no
  // mesmo temporizador, para a atualização nunca rodar síncrona no efeito.
  const emRajada = pedidoAtivo !== null && agora !== 0 && agora - pedidoAtivo.em < RAJADA_MS
  useEffect(() => {
    const intervalo = emRajada ? 1000 : situacao === 'conectado' ? 10000 : 2000
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
  }, [situacao, emRajada, atualizar])

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
      const em = Date.now()
      frescoAte.current = em + RAJADA_MS
      setPedido({ comando, em, via: b.via, noticiaAntes: estado?.atualizado_em ?? null })
      const nome = NOMES_COMANDO[comando]
      if (b.via === 'direto') setAviso(`${nome} enviada ao serviço agora. Acompanhando a resposta...`)
      else if (servicoVivo === false) setAviso(`${nome} deixada na fila. O serviço não está respondendo, então só vai executar quando voltar.`)
      else setAviso(`${nome} deixada na fila. O serviço pega em poucos segundos; a tela está acompanhando.`)
      atualizar()
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

  async function renomear(chat: ChatWhatsapp) {
    const atual = chat.nome ?? ''
    const nome = window.prompt('Nome desta conversa (nome do contato):', atual)
    if (nome === null) return
    const limpo = nome.trim()
    if (!limpo || limpo === atual) return
    await fetch('/api/painel/whatsapp/chat', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat.id, nome: limpo }),
    })
    await atualizar()
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
  const servicoMorto = servicoVivo === false
  const diretoFalhou = saude !== null && !saude.alcancavel && servicoVivo === true
  const segundosDesdePedido = pedidoAtivo && agora ? Math.round((agora - pedidoAtivo.em) / 1000) : 0
  // o aviso do comando só vale enquanto o pedido não foi atendido
  const avisoVisivel = aviso && (pedido === null || pedidoAtivo !== null) ? aviso : null

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
            {mostrarQr && (
              <div className="p-row" style={{ alignItems: 'flex-start', gap: 20, marginBottom: 14 }}>
                <Image src={estado!.qr!} alt="Código QR para conectar o WhatsApp" width={240} height={240} unoptimized style={{ background: '#fff', padding: 10, borderRadius: 12 }} />
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

            {servicoMorto && (
              <div className="p-alert p-alert-danger" style={{ marginBottom: 12 }}>
                <strong>O serviço não está respondendo.</strong> Nenhuma das duas vias deu sinal: nem o endereço direto, nem o
                sinal de vida que ele manda a cada 30 segundos. Os botões deixam o pedido na fila, mas ele só executa quando o
                serviço voltar. Reinicie na hospedagem{p.hospedagemUrl ? <> (<a href={p.hospedagemUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>abrir</a>)</> : ''} e veja os registros: a causa costuma estar na última linha.
              </div>
            )}

            {desatualizado && (
              <div className="p-alert p-alert-danger" style={{ marginBottom: 12 }}>
                <strong>O serviço está rodando uma versão antiga.</strong> Ele responde, mas sem número de versão e sem o
                diagnóstico que as versões atuais mandam a cada 30 segundos. Isso quer dizer que a hospedagem não reconstruiu o
                serviço depois dos últimos deploys. Essa versão antiga ainda tem o defeito que descarta as mensagens que você
                envia do celular. No Railway{p.hospedagemUrl ? <> (<a href={p.hospedagemUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>abrir</a>)</> : ''}: aba
                Deployments, confira a data da última implantação; use <strong>Redeploy</strong> e, se falhar, leia o registro do
                build. Em Settings, o branch deve ser <code>main</code> e o Root Directory <code>servicos/whatsapp</code>.
              </div>
            )}

            {diretoFalhou && (
              <div className="p-alert p-alert-warn" style={{ marginBottom: 12 }}>
                <strong>O serviço está vivo, mas o endereço direto não responde.</strong> Os botões funcionam pela fila, com alguns
                segundos de atraso. Para ficar imediato, confira no Railway se o domínio em <code>WHATSAPP_PONTE_URL</code> foi gerado
                para este serviço e para a porta em que ele escuta.
              </div>
            )}

            {situacao === 'conectado' && (
              <p className="p-muted" style={{ marginBottom: 12 }}>
                Conectado{estado?.numero ? ` ao número ${estado.numero}` : ''}. As conversas aparecem abaixo conforme chegam.
                O painel apenas lê: nenhuma mensagem é enviada por aqui, você responde pelo WhatsApp normal.
              </p>
            )}

            {situacao === 'desconectado' && servicoVivo && !mostrarQr && (
              <p className="p-muted" style={{ marginBottom: 12 }}>
                Sem sessão com o WhatsApp. Clique em <strong>Parear de novo</strong> para gerar o código QR.
              </p>
            )}

            <div className="p-row" style={{ gap: 8, marginBottom: 12 }}>
              <button type="button" className="p-btn p-btn-sm" disabled={ocupado} onClick={() => comandar('pulso')}>
                {executando === 'pulso' ? 'Enviando...' : 'Verificar agora'}
              </button>
              <button type="button" className="p-btn p-btn-sm p-btn-navy" disabled={ocupado} onClick={() => comandar('reconectar')}>
                {executando === 'reconectar' ? 'Enviando...' : 'Reconectar'}
              </button>
              <button type="button" className="p-btn p-btn-sm p-btn-primary" disabled={ocupado} onClick={() => comandar('parear_novamente')}>
                {executando === 'parear_novamente' ? 'Enviando...' : 'Parear de novo (novo QR)'}
              </button>
              {!p.diretoConfigurado && (
                <span className="p-small p-muted">
                  Comandos vão pela fila. Para resposta imediata, configure <code>WHATSAPP_PONTE_URL</code>.
                </span>
              )}
            </div>

            {avisoVisivel && (
              <div className="p-alert p-alert-info" style={{ marginBottom: 12 }}>
                {avisoVisivel}
                {pedidoAtivo && (
                  <span className="p-small" style={{ display: 'block', marginTop: 4, opacity: 0.8 }}>
                    {segundosDesdePedido < RAJADA_MS / 1000
                      ? `Atualizando a cada segundo (${segundosDesdePedido} s). Um QR novo costuma levar de 5 a 15 segundos para aparecer.`
                      : 'Sem resposta no tempo esperado. Se o serviço estiver vivo, tente de novo; se não, reinicie na hospedagem.'}
                  </span>
                )}
              </div>
            )}

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
                      <button type="button" className="p-btn p-btn-sm p-btn-ghost" title="Corrigir o nome desta conversa" onClick={() => renomear(c)}>Renomear</button>
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
