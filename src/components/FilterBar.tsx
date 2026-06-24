'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const selectStyle: React.CSSProperties = {
  background: '#13234F',
  border: '1px solid rgba(255,255,255,.14)',
  color: '#fff',
  borderRadius: 11,
  padding: '13px 18px',
  fontSize: 13.5,
  cursor: 'pointer',
  minWidth: 150,
  appearance: 'none',
  outline: 'none',
  width: '100%',
  fontFamily: "'Jost',sans-serif",
}

const contratoOptions = [
  { label: 'Todos', value: '' },
  { label: 'Comprar', value: 'compra' },
  { label: 'Alugar', value: 'aluguel' },
  { label: 'Temporada', value: 'temporada' },
  { label: 'Lançamentos', value: 'lancamento' },
]

const tipoOptions = ['Todos', 'Apartamento', 'Casa', 'Terreno', 'Cobertura', 'Casa de Condomínio', 'Sobrado', 'Loft']

const bairroOptions = [
  'Todos',
  'Praia da Gamboa',
  'Gamboa',
  'Siriú',
  'Centro Garopaba',
  'Paulo Lopes',
  'Areias',
  'Forquilhas',
  'Pedra Branca',
  'Ingleses',
]

const quartosOptions = [
  { label: 'Todos', value: '' },
  { label: '1+', value: '1' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
  { label: '4+', value: '4' },
]

export default function FilterBar({ searchParams }: { searchParams: Record<string, string> }) {
  const router = useRouter()

  function update(key: string, value: string) {
    const q = new URLSearchParams(searchParams)
    if (value) {
      q.set(key, value)
    } else {
      q.delete(key)
    }
    q.delete('page')
    router.push(`/imoveis?${q.toString()}`)
  }

  const wrapStyle: React.CSSProperties = { position: 'relative', minWidth: 150 }
  const chevron: React.CSSProperties = {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#E8B23A',
    pointerEvents: 'none',
    fontSize: 13,
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={wrapStyle}>
        <select
          value={searchParams.contrato ?? ''}
          onChange={(e) => update('contrato', e.target.value)}
          style={selectStyle}
        >
          {contratoOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <div style={wrapStyle}>
        <select
          value={searchParams.tipo ?? ''}
          onChange={(e) => update('tipo', e.target.value === 'Todos' ? '' : e.target.value)}
          style={selectStyle}
        >
          {tipoOptions.map((o) => (
            <option key={o} value={o === 'Todos' ? '' : o} style={{ background: '#0A1430' }}>{o}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <div style={{ ...wrapStyle, minWidth: 170 }}>
        <select
          value={searchParams.bairro ?? ''}
          onChange={(e) => update('bairro', e.target.value === 'Todos' ? '' : e.target.value)}
          style={{ ...selectStyle, minWidth: 170 }}
        >
          {bairroOptions.map((o) => (
            <option key={o} value={o === 'Todos' ? '' : o} style={{ background: '#0A1430' }}>{o}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <div style={{ ...wrapStyle, minWidth: 130 }}>
        <select
          value={searchParams.quartos ?? ''}
          onChange={(e) => update('quartos', e.target.value)}
          style={{ ...selectStyle, minWidth: 130 }}
        >
          {quartosOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <Link href="/imoveis" style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', cursor: 'pointer', textDecoration: 'underline' }}>Limpar</Link>
    </div>
  )
}
