'use client'


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

const ordemOptions = [
  { label: 'Ordenar', value: '' },
  { label: 'Menor preço', value: 'preco_asc' },
  { label: 'Maior preço', value: 'preco_desc' },
]

const quartosOptions = [
  { label: 'Todos', value: '' },
  { label: '1+', value: '1' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
  { label: '4+', value: '4' },
]

export default function FilterBar({ values, onChange, onClear, cidades, bairros }: { values: Record<string, string>; onChange: (key: string, value: string) => void; onClear: () => void; cidades: string[]; bairros: string[] }) {

  const update = onChange

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
          value={values.contrato ?? ''}
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
          value={values.tipo ?? ''}
          onChange={(e) => update('tipo', e.target.value === 'Todos' ? '' : e.target.value)}
          style={selectStyle}
        >
          {tipoOptions.map((o) => (
            <option key={o} value={o === 'Todos' ? '' : o} style={{ background: '#0A1430' }}>{o}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <div style={{ ...wrapStyle, minWidth: 160 }}>
        <select
          value={values.cidade ?? ''}
          onChange={(e) => update('cidade', e.target.value)}
          style={{ ...selectStyle, minWidth: 160 }}
        >
          <option value="" style={{ background: '#0A1430' }}>Cidade: todas</option>
          {cidades.map((c) => (
            <option key={c} value={c} style={{ background: '#0A1430' }}>{c}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <div style={{ ...wrapStyle, minWidth: 170 }}>
        <select
          value={values.bairro ?? ''}
          onChange={(e) => update('bairro', e.target.value)}
          style={{ ...selectStyle, minWidth: 170 }}
        >
          <option value="" style={{ background: '#0A1430' }}>Bairro: todos</option>
          {bairros.map((b) => (
            <option key={b} value={b} style={{ background: '#0A1430' }}>{b}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <div style={{ ...wrapStyle, minWidth: 130 }}>
        <select
          value={values.quartos ?? ''}
          onChange={(e) => update('quartos', e.target.value)}
          style={{ ...selectStyle, minWidth: 130 }}
        >
          {quartosOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <div style={{ ...wrapStyle, minWidth: 140 }}>
        <select
          value={values.ordem ?? ''}
          onChange={(e) => update('ordem', e.target.value)}
          style={{ ...selectStyle, minWidth: 140 }}
        >
          {ordemOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
          ))}
        </select>
        <span style={chevron}>▾</span>
      </div>

      <input
        type="search"
        defaultValue={values.busca ?? ''}
        placeholder="Buscar por código, título ou região"
        onChange={(e) => update('busca', e.target.value.trim())}
        style={{ ...selectStyle, minWidth: 230, cursor: 'text' }}
      />

      <button onClick={onClear} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', fontFamily: "'Jost',sans-serif" }}>Limpar</button>
    </div>
  )
}
