'use client'

import { useState } from 'react'

export type Local = { bairro: string; cidade: string; total: number }

// Campo de Localização com autocompletar e multi-seleção (chips), usado na
// busca do hero da home e na barra de filtros da listagem. As chaves das
// seleções seguem o formato "Bairro|Cidade", o mesmo do parâmetro locais= da
// URL de /imoveis.
export default function LocationSearch({
  locais,
  selecionados,
  onToggle,
  busca,
  onBuscaChange,
  onSubmit,
  variant = 'filtro',
  permitirCodigo = false,
  onCodigo,
  placeholder,
}: {
  locais: Local[]
  selecionados: string[]
  onToggle: (chave: string) => void
  busca: string
  onBuscaChange: (v: string) => void
  onSubmit?: () => void
  variant?: 'hero' | 'filtro'
  permitirCodigo?: boolean
  onCodigo?: (codigo: string) => void
  placeholder?: string
}) {
  const [aberto, setAberto] = useState(false)

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  // a lista já vem ranqueada por potencial; o filtro de digitação preserva a ordem
  const filtrados = locais.filter((l) => !busca.trim() || norm(`${l.bairro} ${l.cidade}`).includes(norm(busca)))
  const pareceCodigo = permitirCodigo && /^[a-z]{1,3}\d{2,}/i.test(busca.trim())

  const hero = variant === 'hero'
  const boxStyle: React.CSSProperties = hero
    ? { background: 'rgba(255,255,255,.12)', borderRadius: 11, padding: '12px 16px' }
    : { background: '#13234F', border: '1px solid rgba(255,255,255,.14)', borderRadius: 11, padding: '13px 16px' }
  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    color: '#fff',
    border: 'none',
    fontFamily: "'Jost',sans-serif",
    fontSize: hero ? 14 : 13.5,
    width: '100%',
    outline: 'none',
    padding: 0,
    minWidth: 0,
  }

  const placeholderFinal =
    selecionados.length > 0
      ? `${selecionados.length} selecionado${selecionados.length > 1 ? 's' : ''}`
      : placeholder ?? (permitirCodigo ? 'Bairro, cidade ou código' : 'Bairro ou cidade')

  return (
    <div style={{ position: 'relative', textAlign: 'left' }}>
      <div style={boxStyle}>
        {hero && (
          <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>Localização</div>
        )}
        <input
          value={busca}
          onChange={(e) => { onBuscaChange(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 180)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit?.() }}
          placeholder={placeholderFinal}
          style={inputStyle}
        />
      </div>

      {aberto && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 60, background: '#0B1738', border: '1px solid rgba(232,178,58,.4)', borderRadius: 13, boxShadow: '0 16px 44px rgba(0,0,0,.55)', maxHeight: 340, overflowY: 'auto', textAlign: 'left', minWidth: 230 }}>
          {pareceCodigo && (
            <div
              onMouseDown={() => onCodigo?.(busca.trim().toUpperCase())}
              style={{ padding: '12px 16px', fontSize: 13.5, color: '#E8B23A', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.08)' }}
            >
              Buscar pelo código {busca.trim().toUpperCase()} →
            </div>
          )}
          <div style={{ padding: '10px 16px 6px', fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>Bairros</div>
          {filtrados.length === 0 && (
            <div style={{ padding: '10px 16px 14px', fontSize: 13, color: 'rgba(255,255,255,.55)' }}>Nenhum bairro encontrado</div>
          )}
          {filtrados.slice(0, 40).map((l) => {
            const chave = `${l.bairro}|${l.cidade}`
            const marcado = selecionados.includes(chave)
            return (
              <div
                key={chave}
                onMouseDown={(e) => { e.preventDefault(); onToggle(chave) }}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', fontSize: 13.5, color: '#fff', cursor: 'pointer', background: marcado ? 'rgba(232,178,58,.12)' : 'transparent' }}
              >
                <span style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${marcado ? '#E8B23A' : 'rgba(255,255,255,.35)'}`, background: marcado ? '#E8B23A' : 'transparent', color: '#0A1430', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {marcado ? '✓' : ''}
                </span>
                {l.bairro}, {l.cidade} - SC
              </div>
            )
          })}
        </div>
      )}

      {selecionados.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selecionados.map((chave) => (
            <span key={chave} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(232,178,58,.92)', color: '#0A1430', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 30 }}>
              {chave.split('|')[0]}
              <span onClick={() => onToggle(chave)} role="button" aria-label={`Remover ${chave.split('|')[0]}`} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
