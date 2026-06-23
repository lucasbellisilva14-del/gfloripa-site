'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const slides = [
  { img: '/assets/hero-residencial.png', pos: '50% 42%', anim: 'kb1' },
  { img: '/assets/hero-ondas.jpg', pos: '50% 45%', anim: 'kb2' },
  { img: '/assets/hero-baleia.png', pos: '50% 40%', anim: 'kb1' },
]

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [contrato, setContrato] = useState('Comprar')
  const router = useRouter()

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000)
    return () => clearInterval(t)
  }, [])

  const contratoMap: Record<string, string> = {
    'Comprar': '/venda',
    'Alugar': '/alugar',
    'Temporada': '/temporada',
    'Lançamentos': '/lancamentos',
  }

  function handleBuscar() {
    router.push(contratoMap[contrato] ?? '/imoveis')
  }

  return (
    <section
      className="hero"
      style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '60px 48px 76px',
        overflow: 'hidden',
      }}
    >
      {slides.map((s, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div
            className="pimg"
            style={{
              position: 'absolute',
              inset: '-4%',
              backgroundImage: `url('${s.img}')`,
              backgroundPosition: s.pos,
              backgroundSize: 'cover',
              opacity: i === current ? 1 : 0,
              transition: 'opacity 1.8s ease',
              animation: `${s.anim} 20s ease-in-out infinite alternate`,
            }}
          />
        </div>
      ))}

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,rgba(8,16,40,.62),rgba(20,44,74,.28) 46%,rgba(16,60,72,.28))' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 76% 12%, rgba(232,178,58,.4), transparent 46%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(4,9,22,.64))' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,14,34,.58) 0%,transparent 22%,transparent 58%,rgba(8,14,34,.92) 100%)' }} />
      <div className="grain" />

      <div style={{ position: 'absolute', bottom: 24, right: 32, zIndex: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: i === current ? 32 : 16,
              height: 3,
              borderRadius: 3,
              background: i === current ? '#fff' : 'rgba(255,255,255,.4)',
              cursor: 'pointer',
              transition: 'width .5s ease,background .5s ease',
            }}
          />
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        <div style={{ fontSize: 10, letterSpacing: '.34em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>Explore</div>
        <div style={{ width: 1, height: 34, background: 'linear-gradient(rgba(255,255,255,.7),transparent)', transformOrigin: 'top', animation: 'scrollcue 2.2s ease-in-out infinite' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 780 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
          <span style={{ width: 36, height: 1, background: 'rgba(232,178,58,.55)', display: 'block' }} />
          <span style={{ fontSize: 12, letterSpacing: '.34em', textTransform: 'uppercase', color: '#E8B23A' }}>Garopaba · Santa Catarina</span>
          <span style={{ width: 36, height: 1, background: 'rgba(232,178,58,.55)', display: 'block' }} />
        </div>

        <h1
          className="hero-h1"
          style={{ fontFamily: "'Marcellus',serif", fontSize: 74, lineHeight: 1.03, letterSpacing: '-.015em', textShadow: '0 2px 40px rgba(0,0,0,.45)' }}
        >
          O litoral de Garopaba,<br />do seu jeito.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,.82)', maxWidth: 520, margin: '22px auto 0', fontWeight: 300 }}>
          Casas frente-mar, apartamentos com vista e terrenos à beira da Gamboa. Encontre o seu refúgio.
        </p>

        <div style={{ margin: '38px auto 0', maxWidth: 680, background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: 12 }}>
          <div style={{ display: 'flex', gap: 22, justifyContent: 'center', padding: '6px 0 12px', flexWrap: 'wrap' }}>
            {['Comprar', 'Alugar', 'Temporada', 'Lançamentos'].map((c) => (
              <span
                key={c}
                onClick={() => setContrato(c)}
                style={{
                  fontSize: 13,
                  color: contrato === c ? '#fff' : 'rgba(255,255,255,.6)',
                  borderBottom: contrato === c ? '2px solid #E8B23A' : '2px solid transparent',
                  paddingBottom: 6,
                  cursor: 'pointer',
                  transition: 'color .3s, border-color .3s',
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px', background: 'rgba(255,255,255,.12)', borderRadius: 11, padding: '12px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>Tipo</div>
              <div style={{ fontSize: 14, marginTop: 3 }}>Qualquer ▾</div>
            </div>
            <div style={{ flex: '1.3 1 160px', background: 'rgba(255,255,255,.12)', borderRadius: 11, padding: '12px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>Bairro</div>
              <div style={{ fontSize: 14, marginTop: 3 }}>Praia da Gamboa ▾</div>
            </div>
            <button
              onClick={handleBuscar}
              style={{ flex: '1 1 auto', background: '#E8B23A', color: '#0A1430', border: 'none', borderRadius: 11, padding: '14px 30px', fontSize: 14, fontWeight: 500, letterSpacing: '.04em', cursor: 'pointer' }}
            >
              Buscar
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
