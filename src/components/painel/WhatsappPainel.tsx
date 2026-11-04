'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analise, ChatWhatsapp, EstadoWhatsapp } from '@/lib/painel/tipos'
import { ROTULO_STATUS_WHATSAPP } from '@/lib/painel/tipos'
import { formatarData, formatarDataCurta, iniciais, paraData } from '@/lib/painel/formato'
import AnaliseResultadoView from './AnaliseResultadoView'

type Props = {
  estadoInicial: EstadoWhatsapp | null
  chatsIniciais: ChatWhatsapp[]
  pontePronta: boolean
  envioJetimob: boolean
}

type Resposta = {
  analise: Analise & { cliente_nome: string }
  avisos: string[]
  demo: boolean
  mensagens_analisadas: number
}

export default function WhatsappPainel({ estadoInicial, chatsIniciais, pontePronta, envioJetimob }: Props) {
  const [estado, setEstado] = useState(estadoInicial)
  const [chats, setChats] = useState(chatsIniciais)
  const [analisando, setAnalisando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [resposta, setResposta] = useState<Resposta | null>(null)
  // hora atual guardada em estado e renovada a cada verificação; lê-la direto
  // na renderização deixaria o componente impuro
  const [agora, setAgora] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const atualizar = useCallback(async () => {
    setAgora(Date.now())
    try {
      const res = await fetch('/api/painel/whatsapp/chat', { cache: 'no-store' })
      if (!res.ok) return
      const b = await res.json()
      setEstado(b.estado ?? null)
      setChats(b.chats ?? [])
    } catch {
      // rede instável: tenta de novo no próximo ciclo
    }
  }, [])

  // Enquanto não está conectado, olha a cada 4 segundos para pegar o QR novo
  // (ele expira rápido). Conectado, a cada 20, só para ver mensagens novas.
  const conectado = estado?.status === 'conectado'
  useEffect(() => {
    const intervalo = conectado ? 20000 : 4000
    const ciclo = () => {
      timer.current = setTimeout(async () => {
        await atualizar()
        ciclo()
      }, intervalo)
    }
    ciclo()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [conectado, atualizar])

  async function analisar(chat: ChatWhatsapp) {
    setErro(null)
    setResposta(null)
    setAnalisando(chat.id)
    try {
      const res = await fetch('/api/painel/whatsapp/analisar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chat.id }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(b.error ?? `Erro ${res.status}`)
        return
      }
      setResposta(b as Resposta)
      await atualizar()
      setTimeout(() => document.getElementById('resultado-wa')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch {
      setErro('Falha de rede ao analisar a conversa.')
    } finally {
      setAnalisando(null)
    }
  }

  async function arquivar(chat: ChatWhatsapp) {
    await fetch('/api/painel/whatsapp/chat', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat.id, arquivado: true }),
    })
    await atualizar()
  }

  const status = estado?.status ?? 'desconectado'

  // O serviço manda um pulso a cada 2 minutos. Sem pulso recente, o estado
  // guardado é só a última notícia que tivemos, e não prova que ele está de
  // pé: pode ter caído sem conseguir avisar.
  const atualizadoMs = paraData(estado?.atualizado_em)?.getTime() ?? 0
  // agora === 0 na primeira renderização, antes da primeira verificação: sem
  // relógio ainda, não acusamos ausência de pulso
  const minutosSemPulso = agora && atualizadoMs ? Math.floor((agora - atualizadoMs) / 60000) : 0
  const semNoticias = status === 'conectado' && minutosSemPulso > 5

  const classeStatus = semNoticias
    ? 'p-badge-warn'
    : status === 'conectado'
      ? 'p-badge-ok'
      : status === 'desconectado'
        ? 'p-badge-danger'
        : 'p-badge-warn'

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="p-card">
        <div className="p-card-head">
          <h2>Conexão</h2>
          <span className={`p-badge ${classeStatus}`}>
            {semNoticias ? 'Sem notícias do serviço' : ROTULO_STATUS_WHATSAPP[status]}
          </span>
        </div>

        {!pontePronta && (
          <div className="p-alert p-alert-warn">
            A ponte ainda não foi configurada. Falta a variável <code>PAINEL_WHATSAPP_TOKEN</code> na Vercel e no serviço.
            O passo a passo está em <code>docs/painel/whatsapp.md</code>.
          </div>
        )}

        {pontePronta && status === 'aguardando_qr' && estado?.qr && (
          <div className="p-row" style={{ alignItems: 'flex-start', gap: 20 }}>
            <Image src={estado.qr} alt="Código QR para conectar o WhatsApp" width={260} height={260} unoptimized style={{ background: '#fff', padding: 10, borderRadius: 12 }} />
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

        {pontePronta && status === 'desconectado' && (
          <p className="p-muted">
            O serviço da ponte não está no ar, ou acabou de reiniciar. Assim que ele subir, o código aparece aqui.
            {estado?.detalhe ? ` Último aviso: ${estado.detalhe}` : ''}
          </p>
        )}

        {status === 'conectado' && !semNoticias && (
          <p className="p-muted">
            Conectado{estado?.numero ? ` ao número ${estado.numero}` : ''}. As conversas aparecem abaixo conforme chegam.
            O painel apenas lê: nenhuma mensagem é enviada por aqui, você responde pelo WhatsApp normal.
          </p>
        )}

        {semNoticias && (
          <div className="p-alert p-alert-warn">
            O serviço informou que estava conectado, mas não dá sinal de vida{' '}
            há {minutosSemPulso} minutos. Ele manda um
            aviso a cada dois minutos, então provavelmente caiu ou foi reiniciado sem conseguir avisar. Confira os
            registros do serviço na hospedagem. Enquanto isso, as mensagens novas não estão entrando aqui.
          </div>
        )}

        {estado?.atualizado_em && (
          <p className="p-small p-muted" style={{ marginTop: 8 }}>
            Última notícia do serviço: {formatarData(estado.atualizado_em)}
            {estado.detalhe ? ` · ${estado.detalhe}` : ''}
          </p>
        )}
      </section>

      {erro && <div className="p-alert p-alert-danger">{erro}</div>}

      <section className="p-card">
        <div className="p-card-head">
          <h2>Conversas capturadas</h2>
          <span className="p-badge p-badge-neutro">{chats.length}</span>
        </div>
        {chats.length === 0 ? (
          <p className="p-muted">
            Nenhuma conversa ainda. Depois de conectar, cada mensagem nova que chegar ou que você enviar pelo celular
            aparece aqui. Conversas antigas não são importadas.
          </p>
        ) : (
          <ul className="p-list">
            {chats.map((c) => (
              <li key={c.id} className="p-row p-between" style={{ gap: 12 }}>
                <div className="p-row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
                  <span className="p-avatar">{iniciais(c.nome || c.telefone || '?')}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontWeight: 500 }}>{c.nome || c.telefone || 'Sem nome'}</strong>
                    {c.cliente_id && (
                      <Link href={`/painel/clientes/${c.cliente_id}`} className="p-badge p-badge-ok" style={{ marginLeft: 8 }}>
                        ficha do cliente
                      </Link>
                    )}
                    <div className="p-small p-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.total_mensagens} mensagens · {formatarDataCurta(c.ultima_mensagem_em)}
                      {c.ultimo_texto ? ` · ${c.ultimo_texto}` : ''}
                    </div>
                  </div>
                </div>
                <div className="p-row" style={{ gap: 6 }}>
                  <button type="button" className="p-btn p-btn-sm p-btn-primary" disabled={analisando !== null || c.total_mensagens < 2} onClick={() => analisar(c)}>
                    {analisando === c.id ? 'Analisando...' : 'Analisar'}
                  </button>
                  <button type="button" className="p-btn p-btn-sm" onClick={() => arquivar(c)}>Arquivar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resposta && (
        <div id="resultado-wa" style={{ display: 'grid', gap: 14 }}>
          <h2>Análise de {resposta.analise.cliente_nome}</h2>
          <p className="p-small p-muted">{resposta.mensagens_analisadas} mensagens analisadas.</p>
          {resposta.avisos.length > 0 && (
            <div className={`p-alert ${resposta.demo ? 'p-alert-warn' : 'p-alert-info'}`}>
              <ul className="p-bullets">{resposta.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          <AnaliseResultadoView analise={resposta.analise} clienteNome={resposta.analise.cliente_nome} envioJetimob={envioJetimob} />
        </div>
      )}
    </div>
  )
}
