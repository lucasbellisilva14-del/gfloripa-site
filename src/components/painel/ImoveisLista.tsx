'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Property } from '@/lib/jetimob'
import { formatPrice } from '@/lib/jetimob'

function preco(p: Property): string {
  const c = (p.contrato ?? '').toLowerCase()
  if (c.includes('temporada') && p.valor_temporada) return `${formatPrice(p.valor_temporada)} / diária`
  if ((c.includes('loca') || c.includes('aluguel')) && p.valor_locacao) return `${formatPrice(p.valor_locacao)} / mês`
  return formatPrice(p.valor_venda)
}

export default function ImoveisLista({ imoveis }: { imoveis: Property[] }) {
  const [busca, setBusca] = useState('')
  const [contrato, setContrato] = useState('')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return imoveis.filter((p) => {
      if (contrato && !(p.contrato ?? '').toLowerCase().includes(contrato)) return false
      if (!q) return true
      return [p.codigo, p.titulo_anuncio, p.tipo, p.endereco_bairro, p.endereco_cidade].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [imoveis, busca, contrato])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="p-row">
        <input className="p-input" style={{ flex: '1 1 260px' }} placeholder="Buscar por código, título, bairro, cidade..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="p-select" style={{ flex: '0 1 180px' }} value={contrato} onChange={(e) => setContrato(e.target.value)}>
          <option value="">Todos os contratos</option>
          <option value="venda">Venda</option>
          <option value="loca">Locação</option>
          <option value="temporada">Temporada</option>
        </select>
        <span className="p-small p-muted">{filtrados.length} de {imoveis.length}</span>
      </div>
      <div className="p-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="p-table">
          <thead>
            <tr><th>Código</th><th>Imóvel</th><th>Local</th><th>Tipo</th><th>Valor</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.codigo}>
                <td data-rotulo="Código"><strong style={{ fontWeight: 500 }}>{p.codigo}</strong>{p.exclusividade ? <span className="p-badge p-badge-warn" style={{ marginLeft: 6 }}>★ Exclusivo</span> : null}</td>
                <td data-rotulo="Imóvel">{p.titulo_anuncio}</td>
                <td data-rotulo="Local">{[p.endereco_bairro, p.endereco_cidade].filter(Boolean).join(', ')}</td>
                <td data-rotulo="Tipo">{p.tipo}{p.dormitorios ? ` · ${p.dormitorios}q` : ''}</td>
                <td data-rotulo="Valor">{preco(p)} <span className="p-small p-muted">({p.contrato})</span></td>
                <td data-rotulo="Status">{p.status}</td>
                <td><Link href={`/imovel/${p.codigo}`} target="_blank" className="p-btn p-btn-sm">Ver no site</Link></td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="p-muted" style={{ textAlign: 'center', padding: 24 }}>Nenhum imóvel encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
