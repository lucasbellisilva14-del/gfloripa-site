import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyCard from '@/components/PropertyCard'
import FilterBar from '@/components/FilterBar'
import { getProperties, type Property } from '@/lib/jetimob'

const PAGE_SIZE = 24

function Pagination({ currentPage, totalPages, searchParams }: { currentPage: number; totalPages: number; searchParams: Record<string, string> }) {
  const pages: number[] = []
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  function makeHref(p: number) {
    const q = new URLSearchParams({ ...searchParams, page: String(p) })
    return `/imoveis?${q.toString()}`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 48, flexWrap: 'wrap' }}>
      {currentPage > 1 && (
        <Link href={makeHref(currentPage - 1)} style={{ padding: '8px 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.14)', background: '#13234F', color: '#fff', fontSize: 13 }}>← Anterior</Link>
      )}
      {start > 1 && (
        <>
          <Link href={makeHref(1)} style={{ padding: '8px 12px', borderRadius: 11, border: '1px solid rgba(255,255,255,.14)', background: '#13234F', color: '#fff', fontSize: 13 }}>1</Link>
          {start > 2 && <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={makeHref(p)}
          style={{
            padding: '8px 12px',
            borderRadius: 11,
            border: '1px solid rgba(255,255,255,.14)',
            background: p === currentPage ? '#E8B23A' : '#13234F',
            color: p === currentPage ? '#0A1430' : '#fff',
            fontSize: 13,
            fontWeight: p === currentPage ? 600 : 400,
          }}
        >
          {p}
        </Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>…</span>}
          <Link href={makeHref(totalPages)} style={{ padding: '8px 12px', borderRadius: 11, border: '1px solid rgba(255,255,255,.14)', background: '#13234F', color: '#fff', fontSize: 13 }}>{totalPages}</Link>
        </>
      )}
      {currentPage < totalPages && (
        <Link href={makeHref(currentPage + 1)} style={{ padding: '8px 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,.14)', background: '#13234F', color: '#fff', fontSize: 13 }}>Próxima →</Link>
      )}
    </div>
  )
}

export default async function ImoveisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams

  let all: Property[] = []
  let error = false

  try {
    const data = await getProperties({ page: 1, pageSize: 100 })
    all = data.data ?? []
  } catch {
    error = true
  }

  if (!error) {
    const contratoParam = params.contrato
    if (contratoParam) {
      const map: Record<string, string[]> = {
        compra: ['compra', 'venda'],
        aluguel: ['loca', 'aluguel'],
        temporada: ['temporada'],
        lancamento: ['lançamento', 'lancamento'],
      }
      const keywords = map[contratoParam] ?? []
      all = all.filter((p) => keywords.some((k) => p.contrato?.toLowerCase().includes(k)))
    }

    const tipoParam = params.tipo
    if (tipoParam) {
      all = all.filter(
        (p) =>
          p.subtipo?.toLowerCase().includes(tipoParam.toLowerCase()) ||
          p.tipo?.toLowerCase().includes(tipoParam.toLowerCase())
      )
    }

    const bairroParam = params.bairro
    if (bairroParam) {
      all = all.filter(
        (p) =>
          p.endereco_bairro?.toLowerCase().includes(bairroParam.toLowerCase()) ||
          p.endereco_cidade?.toLowerCase().includes(bairroParam.toLowerCase())
      )
    }

    const quartosParam = parseInt(params.quartos ?? '0')
    if (quartosParam > 0) {
      all = all.filter((p) => p.dormitorios >= quartosParam)
    }
  }

  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.max(1, parseInt(params.page ?? '1'))
  const properties = all.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const countText = error ? '' : total > 0 ? `${total} imóveis encontrados` : 'Nenhum imóvel encontrado'

  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
      <Header />

      <div className="sect" style={{ background: '#0B1738', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '26px 48px 22px', position: 'relative', zIndex: 40 }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#E8B23A', marginBottom: 6 }}>Garopaba e região</div>
          <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 30, marginBottom: 18 }}>Imóveis disponíveis</h1>
          <FilterBar searchParams={params} />
          <div style={{ marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,.65)' }}>{countText}</div>
        </div>
      </div>

      <div className="sect" style={{ padding: '34px 48px 70px', maxWidth: 1300, margin: '0 auto' }}>
        {error && (
          <div style={{ textAlign: 'center', padding: '90px 20px' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', border: '2px solid rgba(232,178,58,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontFamily: "'Marcellus',serif", fontSize: 34, color: '#E8B23A' }}>!</div>
            <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 28, marginBottom: 10 }}>Não foi possível carregar os imóveis</h3>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.6)', maxWidth: 420, margin: '0 auto 26px' }}>Tivemos um problema ao conectar com nossa base de imóveis. Aguarde um instante e tente novamente.</p>
            <Link href="/imoveis" style={{ background: 'transparent', color: '#fff', border: '1.5px solid #E8B23A', borderRadius: 40, padding: '14px 28px', fontSize: 13.5, cursor: 'pointer', display: 'inline-block' }}>Tentar novamente</Link>
          </div>
        )}

        {!error && properties.length === 0 && (
          <div style={{ textAlign: 'center', padding: '90px 20px' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'radial-gradient(circle at 50% 125%, #E8B23A 0 52%, transparent 53%), #16265C', margin: '0 auto 24px', opacity: .85 }} />
            <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 28, marginBottom: 10 }}>Nenhum imóvel encontrado</h3>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.6)', maxWidth: 420, margin: '0 auto 26px' }}>Não encontramos imóveis com esses filtros. Tente ampliar a busca ou fale com a gente.</p>
            <Link href="/imoveis" style={{ background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 40, padding: '14px 28px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', display: 'inline-block' }}>Limpar filtros</Link>
          </div>
        )}

        {!error && properties.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 26 }}>
              {properties.map((p) => (
                <PropertyCard key={p.codigo} property={p} />
              ))}
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} searchParams={params} />
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
