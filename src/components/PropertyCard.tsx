import Link from 'next/link'
import Image from 'next/image'
import { type Property, formatPrice } from '@/lib/jetimob'

function getContrato(p: Property): string {
  if (p.contrato?.toLowerCase().includes('venda') || p.contrato?.toLowerCase().includes('compra')) return 'Venda'
  if (p.contrato?.toLowerCase().includes('temporada')) return 'Temporada'
  if (p.contrato?.toLowerCase().includes('loca') || p.contrato?.toLowerCase().includes('aluguel')) return 'Aluguel'
  return p.contrato ?? ''
}

function getPreco(p: Property): string {
  const contrato = getContrato(p)
  if (contrato === 'Venda') {
    return p.valor_venda_visivel && p.valor_venda ? formatPrice(p.valor_venda) : 'Consulte'
  }
  if (contrato === 'Temporada') return p.valor_temporada ? formatPrice(p.valor_temporada) + ' / diária' : 'Consulte'
  return p.valor_locacao ? formatPrice(p.valor_locacao) + ' / mês' : 'Consulte'
}

function getSpecs(p: Property): string {
  const parts: string[] = []
  if (p.dormitorios > 0) parts.push(`${p.dormitorios} quarto${p.dormitorios !== 1 ? 's' : ''}`)
  if (p.suites > 0) parts.push(`${p.suites} suíte${p.suites !== 1 ? 's' : ''}`)
  if (p.garagens > 0) parts.push(`${p.garagens} vaga${p.garagens !== 1 ? 's' : ''}`)
  const area = p.area_util ?? p.area_privativa ?? p.area_total
  if (area && area > 0) parts.push(`${area} ${p.medida ?? 'm²'}`)
  return parts.join(' · ')
}

export default function PropertyCard({ property }: { property: Property }) {
  const img = property.imagens?.[0]?.link_thumb ?? property.imagens?.[0]?.link ?? ''
  const contratoLabel = getContrato(property)
  const tipoBairro = [property.tipo, property.endereco_bairro].filter(Boolean).join(' · ').toUpperCase()
  const preco = getPreco(property)
  const specsText = getSpecs(property)

  return (
    <Link href={`/imovel/${property.codigo}`} className="pcard" style={{ cursor: 'pointer', background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, overflow: 'hidden', display: 'block' }}>
      <div style={{ height: 228, position: 'relative', overflow: 'hidden' }}>
        {img ? (
          <Image
            src={img}
            alt={property.titulo_anuncio}
            fill
            className="pimg"
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 860px) 100vw, 33vw"
          />
        ) : (
          <div className="pimg" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#0E1D48,#1B4965 55%,#5FA8A0)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 45%,rgba(10,20,48,.85))' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 16%, rgba(232,178,58,.32), transparent 40%)' }} />
        <span style={{ position: 'absolute', left: 16, top: 16, background: 'rgba(232,178,58,.95)', color: '#0A1430', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 30, fontWeight: 600 }}>
          {contratoLabel}
        </span>
        <span style={{ position: 'absolute', right: 16, top: 16, color: 'rgba(255,255,255,.8)', fontSize: 11 }}>{property.codigo}</span>
        <div style={{ position: 'absolute', left: 18, bottom: 14, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>{tipoBairro}</div>
      </div>
      <div style={{ padding: '20px 22px 24px' }}>
        <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 21, lineHeight: 1.22, minHeight: 51 }}>{property.titulo_anuncio}</h3>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 8 }}>{specsText}</div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '16px 0 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: "'Marcellus',serif", fontSize: 22, color: '#E8B23A' }}>{preco}</span>
          <span className="parrow" style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>detalhes →</span>
        </div>
      </div>
    </Link>
  )
}
