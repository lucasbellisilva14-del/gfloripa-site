'use client'

import { useState } from 'react'
import LocationSearch, { type Local } from '@/components/LocationSearch'

const selectStyle: React.CSSProperties = {
  background: '#13234F',
  border: '1px solid rgba(255,255,255,.14)',
  color: '#fff',
  borderRadius: 11,
  padding: '13px 18px',
  fontSize: 13.5,
  cursor: 'pointer',
  appearance: 'none',
  outline: 'none',
  width: '100%',
  fontFamily: "'Jost',sans-serif",
}

const inputStyle: React.CSSProperties = { ...selectStyle, cursor: 'text', padding: '13px 14px' }

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.55)',
  marginBottom: 6,
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
  { label: 'Relevância', value: '' },
  { label: 'Menor preço', value: 'preco_asc' },
  { label: 'Maior preço', value: 'preco_desc' },
  { label: 'Maior área', value: 'area_desc' },
  { label: 'Mais recentes', value: 'recentes' },
]

const maisOptions = [
  { label: 'Todos', value: '' },
  { label: '1+', value: '1' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
  { label: '4+', value: '4' },
]

// Filtros da seção expansível: usados no contador do botão "Mais filtros"
const CHAVES_MAIS_FILTROS = ['banheiros', 'vagas', 'preco_min', 'preco_max', 'area_min', 'exclusivos', 'busca']

function Campo({ label, children, minWidth = 150, flex }: { label: string; children: React.ReactNode; minWidth?: number; flex?: string }) {
  return (
    <div style={{ minWidth, flex: flex ?? `0 1 ${minWidth}px` }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  )
}

function Chevron() {
  return (
    <span style={{ position: 'absolute', right: 14, bottom: 15, color: '#E8B23A', pointerEvents: 'none', fontSize: 13 }}>▾</span>
  )
}

export default function FilterBar({
  values,
  onChange,
  onClear,
  locais,
}: {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onClear: () => void
  locais: Local[]
}) {
  const update = onChange
  const [buscaLocal, setBuscaLocal] = useState('')
  const [maisAberto, setMaisAberto] = useState(
    () => values.maisfiltros === '1' || CHAVES_MAIS_FILTROS.some((k) => values[k])
  )

  const selecionados = (values.locais ?? '').split(',').filter(Boolean)
  function toggleLocal(chave: string) {
    const novo = selecionados.includes(chave) ? selecionados.filter((x) => x !== chave) : [...selecionados, chave]
    update('locais', novo.join(','))
  }

  const ativosMais = CHAVES_MAIS_FILTROS.filter((k) => values[k]).length

  return (
    <div>
      {/* Filtros principais, sempre visíveis */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Campo label="Negócio">
          <div style={{ position: 'relative' }}>
            <select value={values.contrato ?? ''} onChange={(e) => update('contrato', e.target.value)} style={selectStyle}>
              {contratoOptions.map((o) => (
                <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
              ))}
            </select>
            <Chevron />
          </div>
        </Campo>

        <Campo label="Tipo de imóvel" minWidth={170}>
          <div style={{ position: 'relative' }}>
            <select
              value={values.tipo ?? ''}
              onChange={(e) => update('tipo', e.target.value === 'Todos' ? '' : e.target.value)}
              style={selectStyle}
            >
              {tipoOptions.map((o) => (
                <option key={o} value={o === 'Todos' ? '' : o} style={{ background: '#0A1430' }}>{o}</option>
              ))}
            </select>
            <Chevron />
          </div>
        </Campo>

        <Campo label="Localização" minWidth={230} flex="2 1 230px">
          <LocationSearch
            locais={locais}
            selecionados={selecionados}
            onToggle={toggleLocal}
            busca={buscaLocal}
            onBuscaChange={setBuscaLocal}
            placeholder="Bairro ou cidade"
          />
          {(values.bairro || values.cidade) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {values.bairro && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(232,178,58,.92)', color: '#0A1430', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 30 }}>
                  {values.bairro}
                  <span onClick={() => update('bairro', '')} role="button" aria-label={`Remover ${values.bairro}`} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
                </span>
              )}
              {values.cidade && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(232,178,58,.92)', color: '#0A1430', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 30 }}>
                  {values.cidade}
                  <span onClick={() => update('cidade', '')} role="button" aria-label={`Remover ${values.cidade}`} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
                </span>
              )}
            </div>
          )}
        </Campo>

        <Campo label="Quartos" minWidth={110}>
          <div style={{ position: 'relative' }}>
            <select value={values.quartos ?? ''} onChange={(e) => update('quartos', e.target.value)} style={selectStyle}>
              {maisOptions.map((o) => (
                <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
              ))}
            </select>
            <Chevron />
          </div>
        </Campo>

        <Campo label="Ordenar" minWidth={150}>
          <div style={{ position: 'relative' }}>
            <select value={values.ordem ?? ''} onChange={(e) => update('ordem', e.target.value)} style={selectStyle}>
              {ordemOptions.map((o) => (
                <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
              ))}
            </select>
            <Chevron />
          </div>
        </Campo>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => setMaisAberto((a) => !a)}
          aria-expanded={maisAberto}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: maisAberto ? 'rgba(232,178,58,.14)' : '#13234F',
            border: `1px solid ${maisAberto ? 'rgba(232,178,58,.55)' : 'rgba(255,255,255,.14)'}`,
            color: '#fff', borderRadius: 11, padding: '11px 18px', fontSize: 13, cursor: 'pointer',
            fontFamily: "'Jost',sans-serif",
          }}
        >
          Mais filtros
          {ativosMais > 0 && (
            <span style={{ background: '#E8B23A', color: '#0A1430', fontSize: 11.5, fontWeight: 700, borderRadius: 20, minWidth: 19, height: 19, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
              {ativosMais}
            </span>
          )}
          <span style={{ color: '#E8B23A', fontSize: 11 }}>{maisAberto ? '▴' : '▾'}</span>
        </button>
        <button onClick={onClear} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', fontFamily: "'Jost',sans-serif", padding: 0 }}>
          Limpar filtros
        </button>
      </div>

      {/* Seção expansível: filtros adicionais */}
      {maisAberto && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <Campo label="Banheiros" minWidth={110}>
            <div style={{ position: 'relative' }}>
              <select value={values.banheiros ?? ''} onChange={(e) => update('banheiros', e.target.value)} style={selectStyle}>
                {maisOptions.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
                ))}
              </select>
              <Chevron />
            </div>
          </Campo>

          <Campo label="Vagas" minWidth={110}>
            <div style={{ position: 'relative' }}>
              <select value={values.vagas ?? ''} onChange={(e) => update('vagas', e.target.value)} style={selectStyle}>
                {maisOptions.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: '#0A1430' }}>{o.label}</option>
                ))}
              </select>
              <Chevron />
            </div>
          </Campo>

          <Campo label="Preço mínimo (R$)" minWidth={150}>
            <input
              type="text"
              inputMode="numeric"
              defaultValue={values.preco_min ?? ''}
              placeholder="Ex.: 300.000"
              onChange={(e) => update('preco_min', e.target.value.replace(/\D/g, ''))}
              style={inputStyle}
            />
          </Campo>

          <Campo label="Preço máximo (R$)" minWidth={150}>
            <input
              type="text"
              inputMode="numeric"
              defaultValue={values.preco_max ?? ''}
              placeholder="Ex.: 900.000"
              onChange={(e) => update('preco_max', e.target.value.replace(/\D/g, ''))}
              style={inputStyle}
            />
          </Campo>

          <Campo label="Área mínima (m²)" minWidth={130}>
            <input
              type="text"
              inputMode="numeric"
              defaultValue={values.area_min ?? ''}
              placeholder="Ex.: 80"
              onChange={(e) => update('area_min', e.target.value.replace(/\D/g, ''))}
              style={inputStyle}
            />
          </Campo>

          <Campo label="Código ou palavra-chave" minWidth={200} flex="1 1 200px">
            <input
              type="search"
              defaultValue={values.busca ?? ''}
              placeholder="Ex.: T0624, frente mar"
              onChange={(e) => update('busca', e.target.value.trim())}
              style={inputStyle}
            />
          </Campo>

          <div style={{ minWidth: 170, paddingTop: 23 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, color: '#fff', fontFamily: "'Jost',sans-serif" }}>
              <input
                type="checkbox"
                checked={values.exclusivos === '1'}
                onChange={(e) => update('exclusivos', e.target.checked ? '1' : '')}
                style={{ width: 18, height: 18, accentColor: '#E8B23A', cursor: 'pointer' }}
              />
              Somente exclusivos
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
