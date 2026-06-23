import Link from 'next/link'
import Header from '@/components/Header'
import HeroCarousel from '@/components/HeroCarousel'
import TouristMap from '@/components/TouristMap'
import Footer from '@/components/Footer'
import PropertyCard from '@/components/PropertyCard'
import { getProperties, type Property } from '@/lib/jetimob'

const regions = [
  { label: 'Gamboa', bairro: 'Praia da Gamboa', grad: 'linear-gradient(150deg,#0E1D48,#1B4965 55%,#5FA8A0)', col: '1', row: '1 / span 2' },
  { label: 'Siriú', bairro: 'Siriú', grad: 'linear-gradient(135deg,#16265C,#2C7A7B,#7FB7B0)', col: '2 / span 2', row: '1' },
  { label: 'Centro', bairro: 'Centro', grad: 'linear-gradient(135deg,#1B2E6B,#3A6EA5,#86B8D9)', col: '2', row: '2' },
  { label: 'Paulo Lopes', bairro: 'Paulo Lopes', grad: 'linear-gradient(150deg,#123A5E,#2C5F5A,#6FA89A)', col: '3', row: '2' },
]

export default async function Home() {
  let featured: Property[] = []
  try {
    const data = await getProperties({ page: 1, pageSize: 6 })
    featured = data.data ?? []
  } catch {
    featured = []
  }

  return (
    <div style={{ fontFamily: "'Jost',sans-serif", background: '#0A1430', color: '#fff' }}>
      <Header />

      <HeroCarousel />

      <section className="sect reveal" style={{ padding: '70px 48px 16px', background: '#0A1430' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 34 }}>
            <div style={{ fontSize: 12, letterSpacing: '.26em', textTransform: 'uppercase', color: '#E8B23A' }}>Onde você quer morar</div>
            <h2 className="sec-h2" style={{ fontFamily: "'Marcellus',serif", fontSize: 38, marginTop: 8 }}>Explore por região</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', maxWidth: 540, margin: '12px auto 0', fontWeight: 300 }}>
              De Gamboa a Paulo Lopes — encontre imóveis no ponto certo do litoral de Garopaba.
            </p>
          </div>
          <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridAutoRows: '200px', gap: 18 }}>
            {regions.map((r) => (
              <Link
                key={r.label}
                href={`/imoveis?bairro=${encodeURIComponent(r.bairro)}`}
                className="pcard"
                style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, minHeight: 200, cursor: 'pointer', border: '1px solid rgba(255,255,255,.08)', gridColumn: r.col, gridRow: r.row, display: 'block' }}
              >
                <div className="pimg" style={{ position: 'absolute', inset: 0, background: r.grad }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 38%,rgba(8,14,34,.85))' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 14%, rgba(232,178,58,.22), transparent 46%)' }} />
                <div style={{ position: 'absolute', left: 22, right: 22, bottom: 20 }}>
                  <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 25, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.55)' }}>{r.label}</h3>
                  <div className="parrow" style={{ fontSize: 12, letterSpacing: '.06em', color: '#E8B23A', marginTop: 5 }}>ver imóveis →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sect" style={{ padding: '64px 48px 76px', background: '#0A1430' }}>
        <div className="reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 34, maxWidth: 1300, marginLeft: 'auto', marginRight: 'auto', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '.26em', textTransform: 'uppercase', color: '#E8B23A' }}>Curadoria Nagamboa</div>
            <h2 className="sec-h2" style={{ fontFamily: "'Marcellus',serif", fontSize: 38, marginTop: 10 }}>Destaques à beira-mar</h2>
          </div>
          <Link href="/imoveis" style={{ fontSize: 13, letterSpacing: '.08em', color: '#E8B23A', cursor: 'pointer' }}>Ver todos →</Link>
        </div>
        <div className="reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 26, maxWidth: 1300, margin: '0 auto' }}>
          {featured.map((p) => (
            <PropertyCard key={p.codigo} property={p} />
          ))}
          {featured.length === 0 && (
            [1,2,3,4,5,6].map((i) => (
              <div key={i} style={{ background: '#10204A', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
                <div className="sk" style={{ height: 228 }} />
                <div style={{ padding: '20px 22px 24px' }}>
                  <div className="sk" style={{ height: 18, width: '85%', borderRadius: 6 }} />
                  <div className="sk" style={{ height: 13, width: '55%', borderRadius: 6, marginTop: 12 }} />
                  <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '18px 0 14px' }} />
                  <div className="sk" style={{ height: 22, width: '45%', borderRadius: 6 }} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="sect cta-band reveal" style={{ background: '#10204A', borderTop: '1px solid rgba(232,178,58,.3)', padding: '50px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 30 }}>
        <h2 className="sec-h2" style={{ fontFamily: "'Marcellus',serif", fontSize: 30, maxWidth: 560 }}>Quer vender ou alugar seu imóvel na Gamboa?</h2>
        <a
          href="https://wa.me/5548984727799"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: '#0A1430', background: '#E8B23A', padding: '15px 30px', borderRadius: 40, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Anunciar com a Nagamboa
        </a>
      </section>

      <TouristMap />

      <Footer />
    </div>
  )
}
