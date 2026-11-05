'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Corretor } from '@/lib/painel/tipos'

type CorretorJetimob = { id: number; nome: string }

// Equipe (só gestor): cria corretores, define senhas, ativa/desativa, muda o
// papel e liga ao corretor do Jetimob (para "Meus imóveis").
export default function EquipeEditor({ corretores, meuId, jetimob }: { corretores: Corretor[]; meuId: number; jetimob: CorretorJetimob[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ usuario: string; senha: string } | null>(null)
  const [ocupado, setOcupado] = useState<number | 'novo' | null>(null)
  const [novo, setNovo] = useState({ usuario: '', nome: '', papel: 'corretor' })
  const [mostrarNovo, setMostrarNovo] = useState(false)

  async function chamar(url: string, metodo: 'POST' | 'PATCH', body: unknown, chave: number | 'novo') {
    setErro(null)
    setOcupado(chave)
    try {
      const res = await fetch(url, { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.error ?? 'Não foi possível salvar')
        return null
      }
      router.refresh()
      return dados as { corretor?: Corretor; senha_temporaria?: string | null }
    } finally {
      setOcupado(null)
    }
  }

  async function definirSenha(c: Corretor) {
    const digitada = window.prompt(`Nova senha para ${c.nome} (mínimo 6 caracteres). Deixe em branco para gerar uma senha temporária.`, '')
    if (digitada === null) return
    const body = digitada.trim() ? { nova_senha: digitada.trim() } : { gerar_senha: true }
    const r = await chamar(`/api/painel/corretores/${c.id}`, 'PATCH', body, c.id)
    if (r?.senha_temporaria) setAviso({ usuario: c.usuario, senha: r.senha_temporaria })
    else if (r) setAviso({ usuario: c.usuario, senha: digitada.trim() })
  }

  async function alternarAtivo(c: Corretor) {
    if (c.ativo && !window.confirm(`Desativar o acesso de ${c.nome}? Os dados ficam guardados; só o login é bloqueado.`)) return
    await chamar(`/api/painel/corretores/${c.id}`, 'PATCH', { ativo: !c.ativo }, c.id)
  }

  async function alternarPapel(c: Corretor) {
    await chamar(`/api/painel/corretores/${c.id}`, 'PATCH', { papel: c.papel === 'gestor' ? 'corretor' : 'gestor' }, c.id)
  }

  async function ligarJetimob(c: Corretor, valor: string) {
    await chamar(`/api/painel/corretores/${c.id}`, 'PATCH', { jetimob_id: valor ? Number(valor) : null }, c.id)
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    const r = await chamar('/api/painel/corretores', 'POST', novo, 'novo')
    if (r?.corretor) {
      setAviso({ usuario: r.corretor.usuario, senha: r.senha_temporaria ?? '' })
      setNovo({ usuario: '', nome: '', papel: 'corretor' })
      setMostrarNovo(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {aviso && (
        <div className="p-alert p-alert-info" data-teste="senha-gerada">
          Senha de <strong>{aviso.usuario}</strong>: <code style={{ fontSize: 15, userSelect: 'all' }}>{aviso.senha}</code>. Passe ao corretor por um canal seguro; ela não aparece de novo. Ele pode trocar em Configurações.
          <button type="button" className="p-btn p-btn-sm p-btn-ghost" style={{ marginLeft: 10 }} onClick={() => setAviso(null)}>Fechar</button>
        </div>
      )}
      {erro && <div className="p-alert p-alert-danger">{erro}</div>}
      <ul className="p-list" data-teste="equipe">
        {corretores.map((c) => (
          <li key={c.id} className="p-row p-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div style={{ minWidth: 180 }}>
              <strong>{c.nome}</strong> <span className="p-small p-muted">@{c.usuario}</span>
              <div className="p-small p-muted">
                {c.papel === 'gestor' ? 'Gestor' : 'Corretor'}
                {c.id === meuId ? ' (você)' : ''}
                {!c.ativo ? ' · desativado' : ''}
                {!c.tem_senha ? ' · sem senha' : ''}
              </div>
            </div>
            <div className="p-row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {jetimob.length > 0 ? (
                <select className="p-select" style={{ maxWidth: 190 }} value={c.jetimob_id ?? ''} disabled={ocupado === c.id} onChange={(e) => ligarJetimob(c, e.target.value)} title="Corretor correspondente no Jetimob (para Meus imóveis)">
                  <option value="">Jetimob: não ligado</option>
                  {jetimob.map((j) => (
                    <option key={j.id} value={j.id}>{j.nome} (#{j.id})</option>
                  ))}
                </select>
              ) : (
                c.jetimob_id && <span className="p-small p-muted">Jetimob #{c.jetimob_id}</span>
              )}
              <button type="button" className="p-btn p-btn-sm" disabled={ocupado === c.id} onClick={() => definirSenha(c)}>
                {c.tem_senha ? 'Nova senha' : 'Definir senha'}
              </button>
              {c.id !== meuId && (
                <>
                  <button type="button" className="p-btn p-btn-sm p-btn-ghost" disabled={ocupado === c.id} onClick={() => alternarPapel(c)}>
                    {c.papel === 'gestor' ? 'Tornar corretor' : 'Tornar gestor'}
                  </button>
                  <button type="button" className="p-btn p-btn-sm p-btn-ghost" disabled={ocupado === c.id} onClick={() => alternarAtivo(c)}>
                    {c.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {mostrarNovo ? (
        <form onSubmit={criar} className="p-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="p-field">
            <label htmlFor="novo-usuario">Usuário</label>
            <input id="novo-usuario" className="p-input" value={novo.usuario} onChange={(e) => setNovo({ ...novo, usuario: e.target.value.toLowerCase() })} placeholder="ex.: ana" required />
          </div>
          <div className="p-field">
            <label htmlFor="novo-nome">Nome</label>
            <input id="novo-nome" className="p-input" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ana Souza" required />
          </div>
          <div className="p-field">
            <label htmlFor="novo-papel">Papel</label>
            <select id="novo-papel" className="p-select" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value })}>
              <option value="corretor">Corretor</option>
              <option value="gestor">Gestor</option>
            </select>
          </div>
          <button type="submit" className="p-btn p-btn-primary" disabled={ocupado === 'novo'}>Criar com senha temporária</button>
          <button type="button" className="p-btn p-btn-ghost" onClick={() => setMostrarNovo(false)}>Cancelar</button>
        </form>
      ) : (
        <div>
          <button type="button" className="p-btn" onClick={() => setMostrarNovo(true)}>Novo corretor</button>
        </div>
      )}
      <p className="p-small p-muted" style={{ margin: 0 }}>
        Cada corretor vê só os próprios clientes, análises e lembretes. O WhatsApp conectado ao painel é o do gestor padrão. Usuário sem senha definida não consegue entrar.
      </p>
    </div>
  )
}
