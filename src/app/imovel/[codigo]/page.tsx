import Link from 'next/link'
import Image from 'next/image'
import { getProperty } from '@/lib/jetimob'

export default async function ImovelPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const property = await getProperty(codigo).catch(() => null)

  if (!property) {
    return (
      <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold text-zinc-700 mb-4">Imóvel não encontrado</h1>
        <Link href="/imoveis" className="text-zinc-500 hover:text-zinc-700 underline">
          Ver todos os imóveis
        </Link>
      </main>
    )
  }

  const preco = property.preco
    ? property.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Consulte'

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link href="/imoveis" className="text-sm text-zinc-500 hover:text-zinc-700">← Voltar</Link>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2">
          {property.fotos.slice(0, 4).map((foto, i) => (
            <div key={i} className={`relative bg-zinc-100 rounded-xl overflow-hidden ${i === 0 ? 'md:col-span-2 h-80' : 'h-48'}`}>
              <Image
                src={foto.url}
                alt={`${property.titulo} - foto ${i + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={i === 0}
              />
            </div>
          ))}
          {property.fotos.length === 0 && (
            <div className="md:col-span-2 h-80 bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-400">
              Sem fotos disponíveis
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div>
              <p className="text-sm text-zinc-500 uppercase tracking-wide">{property.tipo} · {property.contrato}</p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">{property.titulo}</h1>
              <p className="mt-1 text-zinc-500">{property.endereco?.bairro}, {property.endereco?.cidade} — {property.endereco?.estado}</p>
            </div>

            {property.descricao && (
              <div>
                <h2 className="text-lg font-semibold text-zinc-800 mb-2">Descrição</h2>
                <p className="text-zinc-600 leading-relaxed whitespace-pre-line">{property.descricao}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
              <p className="text-2xl font-bold text-zinc-900">{preco}</p>
              {property.area > 0 && (
                <p className="text-sm text-zinc-500">{property.area} m²</p>
              )}
              <div className="grid grid-cols-3 gap-3 text-center text-sm border-t border-zinc-100 pt-4">
                {property.quartos > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-800">{property.quartos}</p>
                    <p className="text-zinc-500">Quartos</p>
                  </div>
                )}
                {property.banheiros > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-800">{property.banheiros}</p>
                    <p className="text-zinc-500">Banheiros</p>
                  </div>
                )}
                {property.vagas > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-800">{property.vagas}</p>
                    <p className="text-zinc-500">Vagas</p>
                  </div>
                )}
              </div>
              <a
                href={`https://wa.me/?text=Tenho interesse no imóvel ${property.codigo}: ${property.titulo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-zinc-900 text-white py-3 rounded-lg font-medium hover:bg-zinc-700 transition-colors"
              >
                Tenho interesse
              </a>
            </div>
            <p className="text-xs text-zinc-400 text-center">Código: {property.codigo}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
