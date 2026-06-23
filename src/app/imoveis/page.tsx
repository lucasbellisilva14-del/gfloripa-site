import Link from 'next/link'
import Image from 'next/image'
import { getProperties, formatPrice, getMainImage, type Property } from '@/lib/jetimob'

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

export default async function ImoveisPage() {
  let properties: Property[] = []
  let error = false

  try {
    const data = await getProperties({ pageSize: 24 })
    properties = data.data ?? []
  } catch {
    error = true
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">← Início</Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900">Imóveis disponíveis</h1>
          {!error && properties.length > 0 && (
            <p className="mt-1 text-zinc-500">{properties.length} imóvel{properties.length !== 1 ? 's' : ''} encontrado{properties.length !== 1 ? 's' : ''}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <PropertyCard key={property.codigo} property={property} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
