'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  // seção ativa da barra inferior
  const emImoveis = /^\/(imoveis|imovel|empreendimento)/.test(pathname ?? '')
  const ativo = pathname === '/' ? 'inicio' : emImoveis ? 'imoveis' : null
  const corItem = (chave: string) => (ativo === chave ? '#E8B23A' : 'rgba(255,255,255,.55)')
  const Dot = ({ chave }: { chave: string }) =>
    ativo === chave ? <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#E8B23A', margin: '3px auto 0' }} /> : null

  const navLinks = [
    { label: 'Comprar', href: '/imoveis?contrato=compra' },
    { label: 'Alugar', href: '/imoveis?contrato=aluguel' },
    { label: 'Temporada', href: '/imoveis?contrato=temporada' },
    { label: 'Lançamentos', href: '/empreendimentos' },
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
          <button
            onClick={() => window.dispatchEvent(new Event('nagamboa:abrir-chat'))}
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
              border: 'none',
              fontFamily: "'Jost',sans-serif",
            }}
          >
            Fale conosco
          </button>
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
            <button
              onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('nagamboa:abrir-chat')) }}
              style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 24, background: '#E8B23A', color: '#0A1430', borderRadius: 12, padding: 15, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: "'Jost',sans-serif" }}
            >
              Fale conosco
            </button>
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
        <Link href="/" style={{ textAlign: 'center', cursor: 'pointer', color: corItem('inicio') }}>
          <div style={{ fontSize: 19 }}>⌂</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Início</div>
          <Dot chave="inicio" />
        </Link>
        <Link href="/imoveis" style={{ textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.55)' }}>
          <div style={{ fontSize: 19 }}>⌕</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Buscar</div>
        </Link>
        <Link href="/imoveis" style={{ textAlign: 'center', cursor: 'pointer', color: corItem('imoveis') }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto' }} aria-hidden="true">
            <path d="M3 11.5 12 4.5l9 7" />
            <path d="M5.5 10.5V19.5h13v-9" />
            <path d="M10 19.5V14h4v5.5" />
          </svg>
          <div style={{ fontSize: 11, marginTop: 2 }}>Imóveis</div>
          <Dot chave="imoveis" />
        </Link>
        <button onClick={() => setMenuOpen(true)} style={{ textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,.55)', background: 'none', border: 'none' }}>
          <div style={{ fontSize: 19 }}>≡</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Menu</div>
        </button>
      </div>
    </>
  )
}
