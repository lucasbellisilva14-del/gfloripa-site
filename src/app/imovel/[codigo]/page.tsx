import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Gallery from '@/components/Gallery'
import { getProperty, formatPrice } from '@/lib/jetimob'

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

export default async function ImovelPage({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const property = await getProperty(codigo).catch(() => null)

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
    { value: property.dormitorios > 0 ? String(property.dormitorios) : '—', label: 'Quartos' },
    { value: property.banheiros > 0 ? String(property.banheiros) : '—', label: 'Banheiros' },
    { value: property.garagens > 0 ? String(property.garagens) : '—', label: 'Vagas' },
    { value: area && area > 0 ? `${area} ${property.medida ?? 'm²'}` : '—', label: 'Área' },
  ]

  const whatsappMsg = encodeURIComponent(`Tenho interesse no imóvel ${property.codigo}: ${property.titulo_anuncio}`)

  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
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
              <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#E8B23A' }}>{property.tipo} · {property.codigo}</div>
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

              <a
                href={`https://wa.me/5548984727799?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', background: '#E8B23A', color: '#0A1430', borderRadius: 12, padding: 15, fontSize: 14, fontWeight: 600, letterSpacing: '.03em', cursor: 'pointer', marginBottom: 10 }}
              >
                Tenho interesse
              </a>
              <a
                href={`https://wa.me/5548984727799?text=${encodeURIComponent(`Gostaria de agendar uma visita ao imóvel ${property.codigo}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', background: 'transparent', border: '1.5px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 12, padding: 15, fontSize: 14, cursor: 'pointer' }}
              >
                Agendar uma visita
              </a>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle at 50% 125%, #E8B23A 0 52%, transparent 53%), #16265C', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14 }}>Nagamboa Imóveis</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>CRECI-SC · Especialistas em Garopaba</div>
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

          <div style={{ marginTop: 40 }}>
            <Link href="/imoveis" style={{ fontSize: 13, color: '#E8B23A', cursor: 'pointer' }}>← Voltar para a busca</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
