'use client'

import { useRef, useState } from 'react'
import type { Analise } from '@/lib/painel/tipos'
import AnaliseResultadoView from './AnaliseResultadoView'

type Resposta = {
  ok: boolean
  demo: boolean
  avisos: string[]
  analise: Analise & { cliente_nome: string }
  cliente_id: string
  data_conversa: string
}

const MAXIMO_ARQUIVOS = 10
const LIMITE_TOTAL = 4 * 1024 * 1024
const ACEITOS = '.txt,.md,.pdf,.zip,.docx,image/png,image/jpeg,image/webp,image/gif'

const ehImagem = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`

export default function AnalisarForm({ iaDisponivel, envioJetimob, exemplo }: { iaDisponivel: boolean; envioJetimob: boolean; exemplo: string }) {
  const [texto, setTexto] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function adicionar(novos: File[]) {
    if (!novos.length) return
    setErro(null)
    setArquivos((atuais) => {
      // evita o mesmo arquivo duas vezes quando se arrasta de novo
      const chave = (f: File) => `${f.name}|${f.size}|${f.lastModified}`
      const vistos = new Set(atuais.map(chave))
      const juntos = [...atuais, ...novos.filter((f) => !vistos.has(chave(f)))]
      if (juntos.length > MAXIMO_ARQUIVOS) {
        setErro(`Máximo de ${MAXIMO_ARQUIVOS} arquivos por análise.`)
        return juntos.slice(0, MAXIMO_ARQUIVOS)
      }
      const total = juntos.reduce((s, f) => s + f.size, 0)
      if (total > LIMITE_TOTAL) {
        setErro(`Os arquivos somam ${(total / 1024 / 1024).toFixed(1)} MB e o limite é 4 MB. Envie menos prints de cada vez.`)
      }
      return juntos
    })
  }

  // colar print direto do recorte de tela, que é como o corretor costuma ter
  function aoColar(e: React.ClipboardEvent) {
    const imagens = Array.from(e.clipboardData.files).filter(ehImagem)
    if (imagens.length) {
      e.preventDefault()
      adicionar(imagens)
    }
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setResposta(null)
    const form = new FormData(e.currentTarget)
    form.delete('arquivo')
    for (const f of arquivos) form.append('arquivo', f)
    setEnviando(true)
    try {
      const res = await fetch('/api/painel/analisar', { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(body.error ?? `Erro ${res.status}`)
        return
      }
      setResposta(body as Resposta)
      setTimeout(() => document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch {
      setErro('Falha de rede ao enviar a conversa.')
    } finally {
      setEnviando(false)
    }
  }

  const totalBytes = arquivos.reduce((s, f) => s + f.size, 0)
  const temImagem = arquivos.some(ehImagem)

  return (
    <>
      <form onSubmit={enviar} onPaste={aoColar} className="p-card" style={{ display: 'grid', gap: 16 }}>
        {!iaDisponivel && (
          <div className="p-alert p-alert-warn">
            <strong>Modo demonstração.</strong> ANTHROPIC_API_KEY não está configurada: a análise devolve um exemplo fixo para você conhecer a tela. Com a chave, a I.A. analisa a conversa de verdade.
          </div>
        )}

        <div className="p-field">
          <div className="p-row p-between">
            <label htmlFor="texto">Conversa (cole o texto, ou envie arquivos e prints abaixo)</label>
            <button type="button" className="p-btn p-btn-sm p-btn-ghost" onClick={() => setTexto(exemplo)}>
              Usar conversa de exemplo
            </button>
          </div>
          <textarea
            id="texto"
            name="texto"
            className="p-textarea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'[24/10/2026 09:12] Cliente: Bom dia! Vi o anúncio da casa...\n[24/10/2026 09:20] Lucas: Bom dia! ...\n\nDica: você pode colar um print aqui com Ctrl+V.'}
          />
        </div>

        <div
          className="p-dropzone"
          style={arrastando ? { borderColor: 'var(--p-gold)', background: 'var(--p-surface)' } : undefined}
          onDragOver={(e) => {
            e.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastando(false)
            adicionar(Array.from(e.dataTransfer.files))
          }}
        >
          <input
            ref={inputRef}
            id="arquivo"
            type="file"
            multiple
            accept={ACEITOS}
            onChange={(e) => {
              adicionar(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <span>
            Arraste aqui, cole com Ctrl+V, ou <label htmlFor="arquivo">escolha arquivos</label>
            <br />
            <span className="p-small">
              Prints de conversa (PNG, JPG), .txt exportado do WhatsApp, .zip da exportação com mídia, .pdf, .md e .docx.
              Até {MAXIMO_ARQUIVOS} arquivos, 4 MB no total.
            </span>
          </span>
        </div>

        {arquivos.length > 0 && (
          <ul className="p-list">
            {arquivos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="p-row p-between">
                <span className="p-row" style={{ gap: 8, minWidth: 0 }}>
                  <span className="p-badge p-badge-neutro">{ehImagem(f) ? 'print' : (f.name.split('.').pop() ?? 'arquivo')}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span className="p-small p-muted">{kb(f.size)}</span>
                </span>
                <button type="button" className="p-btn p-btn-sm" onClick={() => setArquivos((a) => a.filter((_, j) => j !== i))}>
                  Remover
                </button>
              </li>
            ))}
            <li className="p-row p-between p-small p-muted" style={{ border: 0, background: 'transparent', padding: '0 12px' }}>
              <span>
                {arquivos.length} arquivo(s), {(totalBytes / 1024 / 1024).toFixed(2)} MB
              </span>
              <button type="button" className="p-btn p-btn-sm p-btn-ghost" onClick={() => setArquivos([])}>
                Limpar tudo
              </button>
            </li>
          </ul>
        )}

        {temImagem && (
          <div className="p-alert p-alert-info">
            A I.A. vai ler os prints e transcrever a conversa antes de analisar. Mande os prints na ordem da conversa e
            confira a transcrição no resultado, principalmente valores e datas.
          </div>
        )}

        <div className="p-form-grid">
          <div className="p-field">
            <label htmlFor="cliente_nome">Nome do cliente (opcional)</label>
            <input id="cliente_nome" name="cliente_nome" className="p-input" placeholder="Ex.: Mariana Costa" />
          </div>
          <div className="p-field">
            <label htmlFor="cliente_telefone">Telefone / WhatsApp (opcional)</label>
            <input id="cliente_telefone" name="cliente_telefone" className="p-input" placeholder="(48) 99999-0000" inputMode="tel" />
          </div>
          <div className="p-field">
            <label htmlFor="codigo_imovel">Código do imóvel (opcional)</label>
            <input id="codigo_imovel" name="codigo_imovel" className="p-input" placeholder="Ex.: C0412" />
          </div>
          <div className="p-field">
            <label htmlFor="tipo_cliente">Tipo de cliente</label>
            <select id="tipo_cliente" name="tipo_cliente" className="p-select" defaultValue="indefinido">
              <option value="indefinido">Deixar a I.A. deduzir</option>
              <option value="comprador">Comprador</option>
              <option value="locatario">Locatário</option>
              <option value="proprietario">Proprietário</option>
            </select>
          </div>
          <div className="p-field">
            <label htmlFor="data_conversa">Data da conversa (para calcular &quot;sexta&quot;, &quot;amanhã&quot;...)</label>
            <input id="data_conversa" name="data_conversa" type="date" className="p-input" />
            <span className="p-small p-muted">Se vazio, usamos a última data encontrada no texto ou hoje. Em print, informe a data.</span>
          </div>
        </div>

        {erro && <div className="p-alert p-alert-danger">{erro}</div>}

        <div className="p-row p-between">
          <span className="p-small p-muted">A conversa e a análise ficam salvas no histórico do cliente. Dados pessoais: acesso só com login.</span>
          <button type="submit" className="p-btn p-btn-primary" disabled={enviando || (!texto.trim() && arquivos.length === 0)}>
            {enviando ? 'Analisando... isso pode levar até um minuto' : 'Analisar com I.A.'}
          </button>
        </div>
      </form>

      {resposta && (
        <div id="resultado" style={{ marginTop: 28, display: 'grid', gap: 14 }}>
          <h2>Resultado da análise</h2>
          {resposta.avisos.length > 0 && (
            <div className={`p-alert ${resposta.demo ? 'p-alert-warn' : 'p-alert-info'}`}>
              <ul className="p-bullets">{resposta.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          <AnaliseResultadoView analise={resposta.analise} clienteNome={resposta.analise.cliente_nome} envioJetimob={envioJetimob} />
        </div>
      )}
    </>
  )
}
