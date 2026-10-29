'use client'

import { useState } from 'react'

export default function PadraoEditor({ textoInicial, origemInicial, arquivo }: { textoInicial: string; origemInicial: 'arquivo' | 'editado'; arquivo: string }) {
  const [texto, setTexto] = useState(textoInicial)
  const [origem, setOrigem] = useState(origemInicial)
  const [estado, setEstado] = useState<'parado' | 'salvando' | 'ok' | 'erro'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(valor: string) {
    setEstado('salvando')
    setErro(null)
    const res = await fetch('/api/painel/padrao', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto: valor }) })
    const b = await res.json().catch(() => ({}))
    if (!res.ok) {
      setEstado('erro')
      setErro(b.error ?? 'Falha ao salvar')
      return
    }
    setOrigem(b.origem)
    setEstado('ok')
    setTimeout(() => setEstado('parado'), 2000)
  }

  const revisar = (texto.match(/REVISAR/g) ?? []).length

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="p-row p-between">
        <div className="p-row">
          <span className={`p-badge ${origem === 'editado' ? 'p-badge-warn' : 'p-badge-neutro'}`}>
            {origem === 'editado' ? 'Versão editada no painel' : 'Versão do arquivo (src/painel/padrao-atendimento.md)'}
          </span>
          {revisar > 0 && <span className="p-badge p-badge-warn">{revisar} ponto(s) marcados REVISAR</span>}
        </div>
        <div className="p-row">
          <button type="button" className="p-btn" onClick={() => { setTexto(arquivo); salvar('') }} disabled={estado === 'salvando'}>
            Restaurar do arquivo
          </button>
          <button type="button" className="p-btn p-btn-primary" onClick={() => salvar(texto)} disabled={estado === 'salvando' || texto === textoInicial && origem === origemInicial}>
            {estado === 'salvando' ? 'Salvando...' : estado === 'ok' ? 'Salvo!' : 'Salvar padrão'}
          </button>
        </div>
      </div>
      {erro && <div className="p-alert p-alert-danger">{erro}</div>}
      <textarea className="p-textarea p-mono" style={{ minHeight: 520, fontSize: 13.5 }} value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false} />
      <p className="p-small p-muted">
        Este texto entra inteiro no system prompt de toda análise. Markdown é bem-vindo. Travessão e meia-risca não são aceitos. Sem Supabase, a edição vale só até a instância reiniciar; a versão definitiva deve ir para o arquivo no repositório.
      </p>
    </div>
  )
}
