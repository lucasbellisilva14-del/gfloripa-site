import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ImoveisBrowser from '@/components/ImoveisBrowser'
import { getAllProperties, type Property } from '@/lib/jetimob'

export const metadata: Metadata = {
  title: 'Imóveis à venda e aluguel em Garopaba e Praia da Gamboa | Nagamboa Imóveis',
  description:
    'Casas, apartamentos e terrenos à venda, para alugar e temporada em Garopaba, Praia da Gamboa e região. Filtre por cidade, bairro, tipo e preço.',
  alternates: { canonical: 'https://www.nagamboaimoveis.com.br/imoveis' },
}

// Campos que a vitrine usa no navegador; o resto fica fora do payload
function paraVitrine(p: Property): Property {
  return {
    codigo: p.codigo,
    exclusividade: p.exclusividade,
    titulo_anuncio: p.titulo_anuncio,
    contrato: p.contrato,
    tipo: p.tipo,
    subtipo: p.subtipo,
    dormitorios: p.dormitorios,
    suites: p.suites,
    banheiros: p.banheiros,
    garagens: p.garagens,
    area_total: p.area_total,
    area_privativa: p.area_privativa,
    area_util: p.area_util,
    medida: p.medida,
    valor_venda: p.valor_venda,
    valor_locacao: p.valor_locacao,
    valor_temporada: p.valor_temporada,
    valor_venda_visivel: p.valor_venda_visivel,
    valor_locacao_visivel: p.valor_locacao_visivel,
    endereco_bairro: p.endereco_bairro,
    endereco_cidade: p.endereco_cidade,
    imagens: p.imagens?.length ? [p.imagens[0]] : [],
  } as Property
}

export default async function ImoveisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams

  let todos: Property[] = []
  let error = false
  try {
    todos = (await getAllProperties()).map(paraVitrine)
  } catch {
    error = true
  }

  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
      <Header />
      {error ? (
        <div className="sect" style={{ padding: '80px 48px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 28, marginBottom: 12 }}>Não foi possível carregar os imóveis</h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.65)' }}>
            Tivemos um problema ao conectar com nossa base de imóveis. Aguarde um instante e tente novamente.
          </p>
        </div>
      ) : (
        <ImoveisBrowser todos={todos} initial={params} />
      )}
      <Footer />
    </div>
  )
}
