import type { Metadata } from 'next'
import './painel.css'

export const metadata: Metadata = {
  title: 'Painel do Corretor | Nagamboa Imóveis',
  robots: { index: false, follow: false },
}

// Layout raiz da área /painel: só carrega o CSS e desliga a indexação. O
// restante do shell (navegação) fica em (app)/layout.tsx, que exige login.
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
