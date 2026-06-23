'use client'

import { useState } from 'react'
import Image from 'next/image'

const MAP_POINTS = [
  {
    id: 'miradouro',
    num: '01',
    label: 'Miradouro Vista da Gamboa',
    kicker: 'Ponto 01',
    desc: 'De lá de cima, você vê a enseada inteira — a praia, as dunas, as pedras e o oceano aberto. O melhor pôr do sol de Garopaba.',
    meta0: '▸ Miradouro Vista da Gamboa',
    meta1: 'Lat -28.034 · Long -48.617',
    meta2: 'Altitude 86 m',
    tag: 'Vista panorâmica',
    left: '50%', top: '13%',
  },
  {
    id: 'restaurantes',
    num: '02',
    label: 'Restaurantes locais',
    kicker: 'Ponto 02',
    desc: 'Frutos do mar fresquíssimos e tainha na brasa — a gastronomia da Gamboa é parte do refúgio. Almoço com vista pro mar.',
    meta0: '▸ Restaurantes locais',
    meta1: 'Região central da praia',
    meta2: 'Culinária típica catarinense',
    tag: null,
    left: '69%', top: '13%',
  },
  {
    id: 'baleias',
    num: '03',
    label: 'Época das baleias',
    kicker: 'Ponto 03',
    desc: 'Entre julho e novembro, as baleias-francas chegam para parir e amamentar nas águas calmas da Gamboa. Fenômeno único no litoral sul.',
    meta0: '▸ Época das baleias',
    meta1: 'Jul – Nov · observação costeira',
    meta2: 'Baleia-franca-austral',
    tag: 'Temporal',
    left: '33%', top: '38%',
  },
  {
    id: 'casa',
    num: '04',
    label: 'Casa Nagamboa',
    kicker: 'Ponto 04',
    desc: 'Nossa sede fica bem na Gamboa — somos daqui, vivemos daqui, e conhecemos cada detalhe desta praia como poucos.',
    meta0: '▸ Casa Nagamboa',
    meta1: 'R. das Gaivotas, Gamboa',
    meta2: 'CRECI-SC',
    tag: 'Escritório',
    left: '40%', top: '56%',
  },
  {
    id: 'dunas',
    num: '05',
    label: 'Dunas da Gamboa',
    kicker: 'Ponto 05',
    desc: 'As dunas formam a fronteira natural entre a Gamboa e o Parque Nacional — área de preservação e trilhas com vista única.',
    meta0: '▸ Dunas da Gamboa',
    meta1: 'Parque Nacional · trilha',
    meta2: 'Área de preservação',
    tag: 'Natureza',
    left: '39%', top: '78%',
  },
]

export default function TouristMap() {
  const [selected, setSelected] = useState('baleias')

  const active = MAP_POINTS.find((p) => p.id === selected) ?? MAP_POINTS[2]

  return (
    <section className="sect reveal" style={{ padding: '72px 48px 84px', background: '#0B1738' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 12, letterSpacing: '.26em', textTransform: 'uppercase', color: '#E8B23A' }}>Praia da Gamboa</div>
          <h2 className="sec-h2" style={{ fontFamily: "'Marcellus',serif", fontSize: 38, marginTop: 8 }}>Mapa turístico da Gamboa</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', maxWidth: 560, margin: '12px auto 0', fontWeight: 300 }}>
            Os pontos que fazem da Praia da Gamboa um lugar único — do miradouro às dunas, da época das baleias a onde a Nagamboa fica.
          </p>
        </div>

        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 22, alignItems: 'start' }}>
          <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 34px 80px rgba(0,0,0,.5)' }}>
            <Image src="/assets/mapa-gamboa.jpg" alt="Mapa turístico da Praia da Gamboa" width={900} height={600} style={{ display: 'block', width: '100%', height: 'auto' }} />
            {MAP_POINTS.map((p) => {
              const isActive = p.id === selected
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={isActive ? 'mk-active' : ''}
                  style={{
                    position: 'absolute',
                    left: p.left,
                    top: p.top,
                    transform: 'translate(-50%,-50%)',
                    width: isActive ? 18 : 14,
                    height: isActive ? 18 : 14,
                    borderRadius: '50%',
                    background: isActive ? '#E8B23A' : 'rgba(232,178,58,.6)',
                    border: `2px solid ${isActive ? '#E8B23A' : 'rgba(255,255,255,.5)'}`,
                    cursor: 'pointer',
                    padding: 0,
                    zIndex: 2,
                    transition: 'all .25s ease',
                  }}
                />
              )
            })}
            <div style={{ position: 'absolute', left: 16, bottom: 16, fontFamily: "'Courier New',monospace", background: 'rgba(7,14,34,.82)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 8, padding: '11px 14px', fontSize: 11, letterSpacing: '.05em', color: 'rgba(255,255,255,.72)', lineHeight: 1.8, zIndex: 2 }}>
              <div style={{ color: '#E8B23A' }}>{active.meta0}</div>
              <div>{active.meta1}</div>
              <div>{active.meta2}</div>
            </div>
          </div>

          <div style={{ background: 'rgba(16,32,74,.4)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: '.24em', color: '#E8B23A', padding: '18px 18px 12px' }}>— PONTOS VIVOS</div>
            {MAP_POINTS.map((p) => {
              const isActive = p.id === selected
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    padding: '15px 18px',
                    borderTop: '1px solid rgba(255,255,255,.07)',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(232,178,58,.08)' : 'transparent',
                    transition: 'background .25s ease',
                  }}
                >
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: '.1em', color: isActive ? '#E8B23A' : 'rgba(255,255,255,.4)' }}>{p.num}</span>
                  <span style={{ fontFamily: "'Marcellus',serif", fontSize: 16, color: isActive ? '#fff' : 'rgba(255,255,255,.65)' }}>{p.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 34, paddingTop: 30, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <div>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#E8B23A', marginBottom: 14 }}>Ponto · {active.kicker}</div>
            <h3 style={{ fontFamily: "'Marcellus',serif", fontSize: 36, color: '#fff', lineHeight: 1.08 }}>{active.label}</h3>
            {active.tag && (
              <span style={{ display: 'inline-block', marginTop: 16, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#0A1430', background: '#E8B23A', padding: '6px 13px', borderRadius: 20, fontWeight: 600 }}>{active.tag}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'rgba(255,255,255,.78)' }}>{active.desc}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
