'use client'

import { useMemo, useState } from 'react'
import PropertyCard from '@/components/PropertyCard'
import FilterBar from '@/components/FilterBar'
import { type Property } from '@/lib/jetimob'

const PAGE_SIZE = 24

type Filtros = Record<string, string>

// Filtragem no navegador: resposta instantânea aos filtros, sem ida ao servidor
function aplicar(all: Property[], f: Filtros): Property[] {
  let lista = all

  const busca = f.busca?.trim().toLowerCase()
  if (busca) {
    lista = lista.filter((p) =>
      [p.codigo, p.titulo_anuncio, p.endereco_bairro, p.endereco_cidade].some((c) => c?.toLowerCase().includes(busca))
    )
  }

  if (f.cidade) lista = lista.filter((p) => p.endereco_cidade?.toLowerCase() === f.cidade.toLowerCase())

  if (f.locais) {
    const pares = f.locais
      .split(',')
      .map((item) => item.split('|').map((s) => s.trim().toLowerCase()))
      .filter((par) => par[0])
    if (pares.length > 0) {
      lista = lista.filter((p) =>
        pares.some(([b, c]) => p.endereco_bairro?.toLowerCase() === b && (!c || p.endereco_cidade?.toLowerCase() === c))
      )
    }
  }

  if (f.contrato) {
    const map: Record<string, string[]> = {
      compra: ['compra', 'venda'],
      aluguel: ['loca', 'aluguel'],
      temporada: ['temporada'],
      lancamento: ['lançamento', 'lancamento'],
    }
    const kws = map[f.contrato] ?? []
    lista = lista.filter((p) => kws.some((k) => p.contrato?.toLowerCase().includes(k)))
  }

  if (f.tipo) {
    lista = lista.filter(
      (p) => p.subtipo?.toLowerCase().includes(f.tipo.toLowerCase()) || p.tipo?.toLowerCase().includes(f.tipo.toLowerCase())
    )
  }

  if (f.bairro) {
    const aliases: Record<string, { bairro: string; cidade?: string }> = {
      'praia da gamboa': { bairro: 'gamboa', cidade: 'garopaba' },
      'centro garopaba': { bairro: 'centro', cidade: 'garopaba' },
      'siriú': { bairro: 'siriú' },
    }
    const exato = lista.some((p) => p.endereco_bairro?.toLowerCase() === f.bairro.toLowerCase())
    const alias = aliases[f.bairro.toLowerCase()]
    if (exato) {
      lista = lista.filter((p) => p.endereco_bairro?.toLowerCase() === f.bairro.toLowerCase())
    } else if (alias) {
      lista = lista.filter(
        (p) =>
          p.endereco_bairro?.toLowerCase().includes(alias.bairro) &&
          (!alias.cidade || p.endereco_cidade?.toLowerCase().includes(alias.cidade))
      )
    } else {
      lista = lista.filter(
        (p) =>
          p.endereco_bairro?.toLowerCase().includes(f.bairro.toLowerCase()) ||
          p.endereco_cidade?.toLowerCase().includes(f.bairro.toLowerCase())
      )
    }
  }

  const quartos = parseInt(f.quartos ?? '0')
  if (quartos > 0) lista = lista.filter((p) => p.dormitorios >= quartos)

  if (f.ordem === 'preco_asc' || f.ordem === 'preco_desc') {
    const preco = (p: Property) => (p.valor_venda_visivel && p.valor_venda) || null
    lista = [...lista].sort((a, b) => {
      const pa = preco(a)
      const pb = preco(b)
      if (pa === null && pb === null) return 0
      if (pa === null) return 1
      if (pb === null) return -1
      return f.ordem === 'preco_asc' ? pa - pb : pb - pa
    })
  }

  return lista
}

export default function ImoveisBrowser({ todos, initial }: { todos: Property[]; initial: Filtros }) {
  const [filtros, setFiltros] = useState<Filtros>(initial)
  const [page, setPage] = useState(Math.max(1, parseInt(initial.page ?? '1')))

  function mudar(key: string, value: string) {
    setFiltros((f) => {
      const novo = { ...f }
      if (value) novo[key] = value
      else delete novo[key]
      if (key === 'cidade') delete novo.bairro
      return novo
    })
    setPage(1)
    // URL compartilhável sem viagem ao servidor
    const q = new URLSearchParams({ ...filtros, [key]: value })
    if (!value) q.delete(key)
    if (key === 'cidade') q.delete('bairro')
    q.delete('page')
    window.history.replaceState(null, '', `/imoveis${q.size ? `?${q}` : ''}`)
  }

  function limpar() {
    setFiltros({})
    setPage(1)
    window.history.replaceState(null, '', '/imoveis')
  }

  const filtrados = useMemo(() => aplicar(todos, filtros), [todos, filtros])

  const cidades = useMemo(
    () => [...new Set(todos.map((p) => p.endereco_cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [todos]
  )
  const bairros = useMemo(
    () =>
      [
        ...new Set(
          todos
            .filter((p) => !filtros.cidade || p.endereco_cidade?.toLowerCase() === filtros.cidade.toLowerCase())
            .map((p) => p.endereco_bairro)
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [todos, filtros.cidade]
  )

  const total = filtrados.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visiveis = filtrados.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function irPara(p: number) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const btn: React.CSSProperties = { padding: '8px 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.14)', background: '#13234F', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: "'Jost',sans-serif" }

  return (
    <>
      <div className="sect" style={{ background: '#0B1738', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '26px 48px 22px', position: 'relative', zIndex: 40 }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#E8B23A', marginBottom: 6 }}>Garopaba e região</div>
          <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 32, marginBottom: 18 }}>Imóveis disponíveis</h1>
          <FilterBar values={filtros} onChange={mudar} onClear={limpar} cidades={cidades} bairros={bairros} />
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 14 }}>
            {total > 0 ? `${total} ${total === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}` : 'Nenhum imóvel encontrado'}
          </div>
        </div>
      </div>

      <div className="sect" style={{ padding: '36px 48px 70px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          {total === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div style={{ width: 74, height: 74, borderRadius: '50%', margin: '0 auto 22px', background: 'radial-gradient(circle at 50% 120%, #E8B23A 0 52%, transparent 53%), #10204A', border: '1px solid rgba(255,255,255,.1)' }} />
              <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 26, marginBottom: 10 }}>Nenhum imóvel encontrado</h2>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.6)', maxWidth: 420, margin: '0 auto 22px', lineHeight: 1.6 }}>
                Não encontramos imóveis com esses filtros. Tente ampliar a busca ou fale com a gente.
              </p>
              <button onClick={limpar} style={{ background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 40, padding: '13px 26px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {visiveis.map((p) => (
                  <PropertyCard key={p.codigo} property={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 40, flexWrap: 'wrap' }}>
                  {currentPage > 1 && (
                    <button onClick={() => irPara(currentPage - 1)} style={btn}>← Anterior</button>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 2)
                    .map((n, idx, arr) => (
                      <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {idx > 0 && arr[idx - 1] !== n - 1 && <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>…</span>}
                        <button
                          onClick={() => irPara(n)}
                          style={{ ...btn, background: n === currentPage ? '#E8B23A' : '#13234F', color: n === currentPage ? '#0A1430' : '#fff', fontWeight: n === currentPage ? 600 : 400 }}
                        >
                          {n}
                        </button>
                      </span>
                    ))}
                  {currentPage < totalPages && (
                    <button onClick={() => irPara(currentPage + 1)} style={btn}>Próxima →</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
