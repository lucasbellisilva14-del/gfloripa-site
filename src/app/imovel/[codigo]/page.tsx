import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Gallery from '@/components/Gallery'
import InterestForm from '@/components/InterestForm'
import { getProperty, getCorretorById, getAllProperties, formatPrice, type Property } from '@/lib/jetimob'
import PropertyCard from '@/components/PropertyCard'

const SITE_URL = 'https://www.nagamboaimoveis.com.br'

function getContrato(contrato: string): string {
  if (!contrato) return ''
  const c = contrato.toLowerCase()
  if (c.includes('venda') || c.includes('compra')) return 'Venda'
  if (c.includes('temporada')) return 'Temporada'
  if (c.includes('loca') || c.includes('aluguel')) return 'Aluguel'
  return contrato
}

function getPrecoFormatted(property: { contrato: string; valor_venda: number | null; valor_venda_visivel: boolean; valor_locacao: number | null; valor_temporada: number | null }): string {
  const contrato = getContrato(property.contrato)
  if (contrato === 'Venda') {
    return property.valor_venda_visivel && property.valor_venda ? formatPrice(property.valor_venda) : 'Consulte'
  }
  if (contrato === 'Temporada') return property.valor_temporada ? formatPrice(property.valor_temporada) + ' / diária' : 'Consulte'
  return property.valor_locacao ? formatPrice(property.valor_locacao) + ' / mês' : 'Consulte'
}

// Monta o title da página quando o painel não tem meta_title preenchido.
// Exemplo: "Casa 3 quartos em Gamboa, R$ 980.000 | Nagamboa Imóveis"
function buildTitle(property: Property): string {
  const tipo = property.subtipo || property.tipo || 'Imóvel'
  const partes: string[] = [tipo]
  if (property.dormitorios > 0) {
    partes.push(`${property.dormitorios} ${property.dormitorios === 1 ? 'quarto' : 'quartos'}`)
  }
  let texto = partes.join(' ')
  if (property.endereco_bairro) texto += ` em ${property.endereco_bairro}`
  else if (property.endereco_cidade) texto += ` em ${property.endereco_cidade}`
  if (property.valor_venda_visivel && property.valor_venda) {
    texto += `, ${formatPrice(property.valor_venda)}`
  }
  return `${texto} | Nagamboa Imóveis`
}

// Primeira frase das observações, sem quebras de linha nem travessões,
// limitada a ~155 caracteres para caber na SERP.
function buildDescription(property: Property): string {
  const texto = (property.observacoes || '')
    .replace(/[—–]/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
  if (!texto) {
    const local = [property.endereco_bairro, property.endereco_cidade].filter(Boolean).join(', ')
    return `${property.titulo_anuncio || 'Imóvel'}${local ? ` em ${local}` : ''}. Fale com a Nagamboa Imóveis.`
  }
  const fimDaFrase = texto.search(/[.!?](\s|$)/)
  const frase = fimDaFrase > 20 ? texto.slice(0, fimDaFrase + 1) : texto
  if (frase.length <= 155) return frase
  return frase.slice(0, 152).trimEnd() + '...'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>
}): Promise<Metadata> {
  const { codigo } = await params
  const property = await getProperty(codigo).catch(() => null)

  if (!property) {
    return {
      title: 'Imóvel não disponível | Nagamboa Imóveis',
      robots: { index: false, follow: false },
    }
  }

  // O painel às vezes espelha o título do anúncio em meta_title/meta_description;
  // só valem quando foram realmente personalizados (diferentes do anúncio)
  const metaTitleCustom =
    property.meta_title && property.meta_title.trim() !== (property.titulo_anuncio ?? '').trim()
      ? property.meta_title
      : null
  const metaDescCustom =
    property.meta_description && property.meta_description.trim() !== (property.titulo_anuncio ?? '').trim()
      ? property.meta_description
      : null
  const title = metaTitleCustom || buildTitle(property)
  const description = metaDescCustom || buildDescription(property)
  const url = `${SITE_URL}/imovel/${property.codigo}`
  const imagem = property.imagens?.[0]?.link

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Nagamboa Imóveis',
      locale: 'pt_BR',
      images: imagem ? [{ url: imagem, alt: property.titulo_anuncio || title }] : undefined,
    },
    twitter: {
      card: imagem ? 'summary_large_image' : 'summary',
      title,
      description,
      images: imagem ? [imagem] : undefined,
    },
  }
}

// JSON-LD Schema.org do imóvel para resultados enriquecidos.
function buildJsonLd(property: Property) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.titulo_anuncio || `Imóvel ${property.codigo}`,
    description: property.meta_description || buildDescription(property),
    url: `${SITE_URL}/imovel/${property.codigo}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.endereco_cidade || 'Garopaba',
      addressRegion: property.endereco_estado || 'Santa Catarina',
      addressCountry: 'BR',
      ...(property.endereco_bairro ? { streetAddress: property.endereco_bairro } : {}),
    },
  }
  if (property.imagens?.length) {
    jsonLd.image = property.imagens.slice(0, 5).map((img) => img.link).filter(Boolean)
  }
  if (property.latitude && property.longitude) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: property.latitude,
      longitude: property.longitude,
    }
  }
  if (property.valor_venda_visivel && property.valor_venda) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: property.valor_venda,
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/imovel/${property.codigo}`,
    }
  }
  return jsonLd
}

export default async function ImovelPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const property = await getProperty(codigo).catch(() => null)
  const corretor = property ? await getCorretorById(property.id_corretor).catch(() => null) : null

  // Imóveis relacionados: mesma cidade, priorizando mesmo bairro e tipo,
  // com preço na faixa de até ~60% de diferença quando houver preço
  let relacionados: Property[] = []
  if (property) {
    try {
      const todas = await getAllProperties()
      const preco = (x: Property) => (x.valor_venda_visivel && x.valor_venda) || x.valor_locacao || null
      const precoBase = preco(property)
      relacionados = todas
        .filter((x) => x.codigo !== property.codigo && x.endereco_cidade === property.endereco_cidade)
        .map((x) => {
          let pontos = 0
          if (x.endereco_bairro === property.endereco_bairro) pontos += 2
          if (x.tipo === property.tipo) pontos += 1
          if (x.subtipo === property.subtipo) pontos += 1
          const px = preco(x)
          if (precoBase && px && Math.abs(px - precoBase) / precoBase <= 0.6) pontos += 2
          return { x, pontos }
        })
        .filter((r) => r.pontos >= 2)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 3)
        .map((r) => r.x)
    } catch {
      relacionados = []
    }
  }

  if (!property) {
    return (
      <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
        <Header />
        <div style={{ padding: '80px 48px', maxWidth: 1240, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: 74, height: 74, borderRadius: '50%', border: '2px solid rgba(232,178,58,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontFamily: "'Marcellus',serif", fontSize: 34, color: '#E8B23A' }}>!</div>
          <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 28, marginBottom: 12 }}>Este imóvel não está mais disponível</h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', maxWidth: 480, margin: '0 auto 26px', lineHeight: 1.6 }}>Ele pode ter sido vendido, alugado ou retirado do nosso portfólio. Mas temos outras ótimas opções esperando por você.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/imoveis" style={{ background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 40, padding: '14px 26px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', display: 'inline-block' }}>Ver imóveis similares</Link>
            <Link href="/" style={{ background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 40, padding: '14px 26px', fontSize: 13.5, cursor: 'pointer', display: 'inline-block' }}>Voltar ao início</Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const contratoLabel = getContrato(property.contrato)
  const preco = getPrecoFormatted(property)
  const area = property.area_util ?? property.area_privativa ?? property.area_total
  const localText = [property.endereco_bairro, property.endereco_cidade, property.endereco_estado].filter(Boolean).join(', ')

  const specBoxes = [
    { value: property.dormitorios > 0 ? String(property.dormitorios) : '-', label: 'Quartos' },
    { value: property.banheiros > 0 ? String(property.banheiros) : '-', label: 'Banheiros' },
    { value: property.garagens > 0 ? String(property.garagens) : '-', label: 'Vagas' },
    { value: area && area > 0 ? `${area} ${property.medida ?? 'm²'}` : '-', label: 'Área' },
  ]

  const terreno = parseFloat(property.terreno_total ?? '')
  if (!Number.isNaN(terreno) && terreno > 0) {
    specBoxes.push({
      value: `${terreno.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${property.medida_terreno_total ?? 'm²'}`,
      label: 'Terreno',
    })
  }
  if (property.financiavel === 1 || property.financiavel === 0) {
    specBoxes.push({ value: property.financiavel === 1 ? 'Sim' : 'Não', label: 'Financiável' })
  }

  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(property)) }}
      />
      <Header />

      <div className="sect" style={{ background: '#0A1430', padding: '24px 48px 80px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 18 }}>
            <Link href="/" style={{ cursor: 'pointer' }}>Início</Link>
            {' '}&nbsp;/&nbsp;{' '}
            <Link href="/imoveis" style={{ cursor: 'pointer' }}>Imóveis</Link>
            {' '}&nbsp;/&nbsp;{' '}
            <span style={{ color: '#E8B23A' }}>{property.codigo}</span>
          </div>

          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 36, alignItems: 'start' }}>
            <Gallery images={property.imagens ?? []} contratoLabel={contratoLabel} />

            <div style={{ position: 'sticky', top: 80 }}>
              <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#E8B23A', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{property.tipo} · {property.codigo}</span>
                {property.exclusividade && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(232,178,58,.95)', color: '#0A1430', borderRadius: 30, padding: '5px 11px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A1430" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z" />
                    </svg>
                    Exclusivo Nagamboa
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 34, lineHeight: 1.16, margin: '10px 0 8px' }}>{property.titulo_anuncio}</h1>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.62)' }}>{localText}</div>
              <div style={{ fontFamily: "'Marcellus',serif", fontSize: 34, color: '#E8B23A', margin: '22px 0 4px' }}>{preco}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)' }}>
                {property.valor_locacao && contratoLabel !== 'Venda' ? 'Valor mensal' : ''}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '24px 0' }}>
                {specBoxes.map((b) => (
                  <div key={b.label} style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 11, padding: '14px 16px' }}>
                    <div style={{ fontSize: 20, fontFamily: "'Marcellus',serif", color: '#fff' }}>{b.value}</div>
                    <div style={{ fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{b.label}</div>
                  </div>
                ))}
              </div>

              <InterestForm codigo={property.codigo} titulo={property.titulo_anuncio} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px' }}>
                {corretor?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={corretor.avatar} alt={corretor.nome} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(232,178,58,.6)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle at 50% 125%, #E8B23A 0 52%, transparent 53%), #16265C', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: 14 }}>{corretor ? corretor.nome : 'Nagamboa Imóveis'}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                    {corretor ? `${corretor.cargo || 'Corretor responsável'} · CRECI ${corretor.creci}` : 'CRECI-SC 10145-J · Especialistas em Garopaba'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 36, marginTop: 46, alignItems: 'start' }}>
            <div>
              {property.observacoes && (
                <>
                  <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 24, marginBottom: 14 }}>Sobre o imóvel</h2>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,.72)', whiteSpace: 'pre-line' }}>{property.observacoes}</p>
                </>
              )}
            </div>

            <div>
              <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 24, marginBottom: 16 }}>Localização</h2>
              <div style={{ height: 220, borderRadius: 14, background: 'linear-gradient(150deg,#12325A,#1E4D6B)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 40px),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 40px)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '48%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#E8B23A', margin: '0 auto 6px', boxShadow: '0 0 0 8px rgba(232,178,58,.25)' }} />
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>{property.endereco_bairro}</div>
                </div>
              </div>
              {(property.latitude || property.longitude) && (
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)', marginTop: 10 }}>
                  Lat {property.latitude} · Long {property.longitude}
                </div>
              )}
            </div>
          </div>

          {relacionados.length > 0 && (
            <div style={{ marginTop: 56 }}>
              <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 26, marginBottom: 20 }}>Você também pode gostar</h2>
              <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {relacionados.map((r) => (
                  <PropertyCard key={r.codigo} property={r} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 40 }}>
            <Link href="/imoveis" style={{ fontSize: 13, color: '#E8B23A', cursor: 'pointer' }}>← Voltar para a busca</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
