'use client'

import { useState } from 'react'
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

export default function AnalisarForm({ iaDisponivel, envioJetimob, exemplo }: { iaDisponivel: boolean; envioJetimob: boolean; exemplo: string }) {
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resposta, setResposta] = useState<Resposta | null>(null)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setResposta(null)
    const form = new FormData(e.currentTarget)
    if (arquivo) form.set('arquivo', arquivo)
    else form.delete('arquivo')
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

  return (
    <>
      <form onSubmit={enviar} className="p-card" style={{ display: 'grid', gap: 16 }}>
        {!iaDisponivel && (
          <div className="p-alert p-alert-warn">
            <strong>Modo demonstração.</strong> ANTHROPIC_API_KEY não está configurada: a análise devolve um exemplo fixo para você conhecer a tela. Com a chave, a I.A. analisa a conversa de verdade.
          </div>
        )}

        <div className="p-field">
          <div className="p-row p-between">
            <label htmlFor="texto">Conversa (cole o texto ou exporte do WhatsApp)</label>
            <button type="button" className="p-btn p-btn-sm p-btn-ghost" onClick={() => { setTexto(exemplo); setArquivo(null) }}>
              Usar conversa de exemplo
            </button>
          </div>
          <textarea id="texto" name="texto" className="p-textarea" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'[24/10/2026 09:12] Cliente: Bom dia! Vi o anúncio da casa...\n[24/10/2026 09:20] Lucas: Bom dia! ...'} disabled={Boolean(arquivo)} />
        </div>

        <div className="p-dropzone">
          <input id="arquivo" type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          {arquivo ? (
            <span>
              Arquivo: <strong>{arquivo.name}</strong> ({Math.round(arquivo.size / 1024)} KB){' '}
              <button type="button" className="p-btn p-btn-sm" style={{ marginLeft: 8 }} onClick={() => setArquivo(null)}>Remover</button>
            </span>
          ) : (
            <span>
              ou <label htmlFor="arquivo">envie um arquivo</label> .txt exportado do WhatsApp, .md ou .pdf simples (até 2 MB)
            </span>
          )}
        </div>

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
            <span className="p-small p-muted">Se vazio, usamos a última data encontrada no texto ou hoje.</span>
          </div>
        </div>

        {erro && <div className="p-alert p-alert-danger">{erro}</div>}

        <div className="p-row p-between">
          <span className="p-small p-muted">A conversa e a análise ficam salvas no histórico do cliente. Dados pessoais: acesso só com login.</span>
          <button type="submit" className="p-btn p-btn-primary" disabled={enviando || (!texto.trim() && !arquivo)}>
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
