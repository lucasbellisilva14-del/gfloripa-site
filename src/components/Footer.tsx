import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      className="sect cta-band"
      style={{
        background: '#07112B',
        color: 'rgba(255,255,255,.6)',
        padding: '28px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12.5,
        borderTop: '1px solid rgba(255,255,255,.06)',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <Link href="/">
        <Image src="/assets/logo-white.png" alt="Nagamboa Imóveis" height={30} width={120} style={{ height: 30, width: 'auto', display: 'block' }} />
      </Link>
      <div>Garopaba · Praia da Gamboa · Ferrugem · Silveira</div>
      <div>CRECI-SC · © 2025 Nagamboa Imóveis</div>
    </footer>
  )
}
