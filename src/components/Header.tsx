'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { label: 'Comprar', href: '/venda' },
    { label: 'Alugar', href: '/alugar' },
    { label: 'Temporada', href: '/temporada' },
    { label: 'Lançamentos', href: '/lancamentos' },
    { label: 'Imóveis', href: '/imoveis' },
    { label: 'Sobre', href: '/sobre' },
  ]

  return (
    <>
      <header
        className="hdr"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 48px',
          background: 'rgba(10,20,48,.86)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}
      >
        <Link href="/">
          <Image src="/assets/logo-white.png" alt="Nagamboa Imóveis" height={36} width={140} style={{ height: 36, width: 'auto', display: 'block' }} priority />
        </Link>

        <div className="d-nav" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <nav style={{ display: 'flex', gap: 28, fontSize: 12.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.78)' }}>
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} style={{ cursor: 'pointer', color: 'rgba(255,255,255,.78)' }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <a
            href="https://wa.me/5548984727799"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11.5,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: '#0A1430',
              background: '#E8B23A',
              padding: '10px 20px',
              borderRadius: 40,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Fale conosco
          </a>
        </div>

        <button
          className="m-burger"
          onClick={() => setMenuOpen(true)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: '#13234F',
            border: '1px solid rgba(255,255,255,.14)',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 20,
            color: '#fff',
          }}
        >
          ≡
        </button>
      </header>

      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0A1430', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <Image src="/assets/logo-white.png" alt="Nagamboa" height={30} width={120} style={{ height: 30, width: 'auto' }} />
            <button
              onClick={() => setMenuOpen(false)}
              style={{ width: 42, height: 42, borderRadius: 11, background: '#13234F', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: '#fff' }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '8px 22px' }}>
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,.08)', cursor: 'pointer' }}
              >
                <span style={{ fontFamily: "'Marcellus',serif", fontSize: 22 }}>{l.label}</span>
                <span style={{ color: '#E8B23A' }}>→</span>
              </Link>
            ))}
            <a
              href="https://wa.me/5548984727799"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', textAlign: 'center', marginTop: 24, background: '#E8B23A', color: '#0A1430', borderRadius: 12, padding: 15, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Fale conosco
            </a>
          </div>
        </div>
      )}

      <div
        className="bottomnav"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 80,
          height: 64,
          background: 'rgba(7,17,43,.97)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,.1)',
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingBottom: 4,
        }}
      >
        <Link href="/" style={{ textAlign: 'center', cursor: 'pointer', color: '#fff' }}>
          <div style={{ fontSize: 19 }}>⌂</div>
          <div style={{ fontSize: 9.5, marginTop: 2 }}>Início</div>
        </Link>
        <Link href="/imoveis" style={{ textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.55)' }}>
          <div style={{ fontSize: 19 }}>⌕</div>
          <div style={{ fontSize: 9.5, marginTop: 2 }}>Buscar</div>
        </Link>
        <Link href="/imoveis" style={{ textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.55)' }}>
          <div style={{ fontSize: 19 }}>▦</div>
          <div style={{ fontSize: 9.5, marginTop: 2 }}>Imóveis</div>
        </Link>
        <button onClick={() => setMenuOpen(true)} style={{ textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.55)', background: 'none', border: 'none' }}>
          <div style={{ fontSize: 19 }}>≡</div>
          <div style={{ fontSize: 9.5, marginTop: 2 }}>Menu</div>
        </button>
      </div>
    </>
  )
}
