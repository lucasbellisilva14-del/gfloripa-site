import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Gallery from '@/components/Gallery'
import PropertyCard from '@/components/PropertyCard'
import FaleComLia from '@/components/FaleComLia'
import { getCondominioByCodigo, getAllProperties, type Condominio, type Property } from '@/lib/jetimob'

const SITE_URL = 'https://www.nagamboaimoveis.com.br'

function statusLabel(c: Condominio): string {
  if (c.situacao === 'Na planta') return 'Na planta'
  if (c.situacao === 'Em construção') return 'Em construção'
  if (c.lancamento) return 'Lançamento'
  return c.situacao ?? 'Disponível'
}

function entregaLabel(c: Condominio): string | null {
  if (!c.entrega_ano) return null
  const mes = c.entrega_mes ? String(c.entrega_mes).padStart(2, '0') + '/' : ''
  return `${mes}${c.entrega_ano}`
}

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params
  const c = await getCondominioByCodigo(codigo).catch(() => null)
  if (!c) {
    return { title: 'Empreendimento não disponível | Nagamboa Imóveis', robots: { index: false, follow: false } }
  }
  const local = [c.endereco_bairro, c.endereco_cidade].filter(Boolean).join(', ')
  const title = `${c.nome}${local ? `, ${local}` : ''} | Nagamboa Imóveis`
  const description = (c.observacoes ?? '').replace(/\s+/g, ' ').trim().slice(0, 155) ||
    `${c.nome}: empreendimento ${statusLabel(c).toLowerCase()} em ${local || 'Garopaba'}. Conheça as unidades disponíveis.`
  const url = `${SITE_URL}/empreendimento/${c.codigo}`
  const imagem = c.imagens?.[0]?.link
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: imagem ? [{ url: imagem }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: imagem ? [imagem] : undefined },
  }
}

export default async function EmpreendimentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const condominio = await getCondominioByCodigo(codigo).catch(() => null)

  if (!condominio) {
    return (
      <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
        <Header />
        <div style={{ padding: '80px 48px', maxWidth: 1240, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 28, marginBottom: 12 }}>Este empreendimento não está mais disponível</h1>
          <Link href="/empreendimentos" style={{ color: '#E8B23A', fontSize: 14 }}>Ver outros empreendimentos →</Link>
        </div>
        <Footer />
      </div>
    )
  }

  let unidades: Property[] = []
  try {
    const todas = await getAllProperties()
    unidades = todas.filter((p) => p.id_condominio === condominio.id_condominio)
  } catch {
    unidades = []
  }

  const local = [condominio.endereco_bairro, condominio.endereco_cidade, condominio.endereco_estado].filter(Boolean).join(', ')
  const entrega = entregaLabel(condominio)
  const ficha = [
    { label: 'Status', value: statusLabel(condominio) },
    ...(entrega ? [{ label: 'Previsão de entrega', value: entrega }] : []),
    ...(condominio.tipo ? [{ label: 'Tipo', value: condominio.tipo }] : []),
    ...(condominio.fechado ? [{ label: 'Condomínio', value: 'Fechado' }] : []),
    ...(condominio.construtora ? [{ label: 'Construtora', value: condominio.construtora }] : []),
    ...(condominio.incorporadora ? [{ label: 'Incorporadora', value: condominio.incorporadora }] : []),
  ]
  const galleryImages = (condominio.imagens ?? []).map((i) => ({ link: i.link, link_thumb: i.link, titulo: i.titulo }))
  // infraestruturas vem como string separada por vírgulas
  const infraItens = (condominio.infraestruturas ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  return (
    <div style={{ background: '#0A1430', minHeight: '100vh', fontFamily: "'Jost',sans-serif", color: '#fff' }}>
      <Header />

      <div className="sect" style={{ padding: '24px 48px 80px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 18 }}>
            <Link href="/" style={{ cursor: 'pointer' }}>Início</Link>
            {' '}&nbsp;/&nbsp;{' '}
            <Link href="/empreendimentos" style={{ cursor: 'pointer' }}>Empreendimentos</Link>
            {' '}&nbsp;/&nbsp;{' '}
            <span style={{ color: '#E8B23A' }}>{condominio.nome}</span>
          </div>

          <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 36, alignItems: 'start' }}>
            <Gallery images={galleryImages} contratoLabel={statusLabel(condominio)} />

            <div style={{ position: 'sticky', top: 80 }}>
              <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#E8B23A' }}>Empreendimento</div>
              <h1 style={{ fontFamily: "'Marcellus',serif", fontSize: 34, lineHeight: 1.16, margin: '10px 0 8px' }}>{condominio.nome}</h1>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.62)' }}>{local}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '24px 0' }}>
                {ficha.map((b) => (
                  <div key={b.label} style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.08)', borderRadius: 11, padding: '14px 16px' }}>
                    <div style={{ fontSize: 16, fontFamily: "'Marcellus',serif", color: '#fff' }}>{b.value}</div>
                    <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{b.label}</div>
                  </div>
                ))}
              </div>

              <FaleComLia assunto="este empreendimento" />
            </div>
          </div>

          {condominio.observacoes && (
            <div style={{ marginTop: 46, maxWidth: 760 }}>
              <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 24, marginBottom: 14 }}>Sobre o empreendimento</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,.72)', whiteSpace: 'pre-line' }}>{condominio.observacoes}</p>
            </div>
          )}

          {infraItens.length > 0 && (
            <div style={{ marginTop: 36 }}>
              <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 24, marginBottom: 14 }}>Estrutura e lazer</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {infraItens.map((item) => (
                  <span key={item} style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.1)', borderRadius: 30, padding: '8px 16px', fontSize: 13, color: 'rgba(255,255,255,.8)' }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 50 }}>
            <h2 style={{ fontFamily: "'Marcellus',serif", fontSize: 26, marginBottom: 6 }}>
              Unidades disponíveis{unidades.length > 0 ? ` (${unidades.length})` : ''}
            </h2>
            {unidades.length > 0 ? (
              <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginTop: 20 }}>
                {unidades.map((p) => (
                  <PropertyCard key={p.codigo} property={p} />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', marginTop: 8 }}>
                Consulte as unidades com a nossa equipe pelo botão acima.
              </p>
            )}
          </div>

          <div style={{ marginTop: 40 }}>
            <Link href="/empreendimentos" style={{ fontSize: 13, color: '#E8B23A', cursor: 'pointer' }}>← Todos os empreendimentos</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
