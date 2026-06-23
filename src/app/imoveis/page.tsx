import Link from 'next/link'
import Image from 'next/image'
import { getProperties, formatPrice, getMainImage, type Property } from '@/lib/jetimob'

const PAGE_SIZE = 24

function PropertyCard({ property }: { property: Property }) {
  const img = getMainImage(property)
  const preco = property.contrato === 'Compra'
    ? (property.valor_venda_visivel ? formatPrice(property.valor_venda) : 'Consulte')
    : formatPrice(property.valor_locacao)

  return (
    <Link href={`/imovel/${property.codigo}`} className="group rounded-xl overflow-hidden border border-zinc-200 bg-white hover:shadow-lg transition-shadow">
      <div className="relative h-52 bg-zinc-100">
        {img ? (
          <Image
            src={img}
            alt={property.titulo_anuncio}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Sem foto</div>
        )}
        {property.destaque === 'Com destaque' && (
          <span className="absolute top-3 left-3 bg-amber-400 text-amber-900 text-xs font-semibold px-2 py-0.5 rounded-full">
            Destaque
          </span>
        )}
      </div>
      <div className="p-4 space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{property.subtipo} · {property.contrato}</p>
        <h2 className="font-semibold text-zinc-900 leading-snug line-clamp-2">{property.titulo_anuncio}</h2>
        <p className="text-sm text-zinc-500">{property.endereco_bairro}, {property.endereco_cidade}</p>
        <p className="text-lg font-bold text-zinc-900">{preco}</p>
        <div className="flex gap-4 text-sm text-zinc-500 pt-1">
          {property.dormitorios > 0 && <span>{property.dormitorios} quarto{property.dormitorios !== 1 ? 's' : ''}</span>}
          {property.banheiros > 0 && <span>{property.banheiros} banheiro{property.banheiros !== 1 ? 's' : ''}</span>}
          {property.garagens > 0 && <span>{property.garagens} vaga{property.garagens !== 1 ? 's' : ''}</span>}
        </div>
      </div>
    </Link>
  )
}

function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const pages = []
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)

  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-center gap-2 mt-12">
      {currentPage > 1 && (
        <Link href={`/imoveis?page=${currentPage - 1}`} className="px-4 py-2 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 hover:bg-zinc-50">
          ← Anterior
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href="/imoveis?page=1" className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 hover:bg-zinc-50">1</Link>
          {start > 2 && <span className="text-zinc-400 text-sm">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={`/imoveis?page=${p}`}
          className={`px-3 py-2 rounded-lg border text-sm ${p === currentPage ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'}`}
        >
          {p}
        </Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-zinc-400 text-sm">…</span>}
          <Link href={`/imoveis?page=${totalPages}`} className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 hover:bg-zinc-50">{totalPages}</Link>
        </>
      )}
      {currentPage < totalPages && (
        <Link href={`/imoveis?page=${currentPage + 1}`} className="px-4 py-2 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 hover:bg-zinc-50">
          Próxima →
        </Link>
      )}
    </div>
  )
}

export default async function ImoveisPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const currentPage = Math.max(1, parseInt(pageParam ?? '1', 10))

  let properties: Property[] = []
  let totalPages = 1
  let total = 0
  let error = false

  try {
    const data = await getProperties({ page: currentPage, pageSize: PAGE_SIZE })
    properties = data.data ?? []
    totalPages = data.totalPages ?? 1
    total = data.total ?? 0
  } catch {
    error = true
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">← Início</Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900">Imóveis disponíveis</h1>
          {!error && total > 0 && (
            <p className="mt-1 text-zinc-500">{total} imóveis encontrados</p>
          )}
        </div>

        {error && (
          <div className="text-center py-24 text-zinc-500">
            Erro ao carregar imóveis. Tente novamente mais tarde.
          </div>
        )}

        {!error && properties.length === 0 && (
          <div className="text-center py-24 text-zinc-500">
            Nenhum imóvel encontrado.
          </div>
        )}

        {!error && properties.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <PropertyCard key={property.codigo} property={property} />
              ))}
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} />
          </>
        )}
      </div>
    </main>
  )
}
