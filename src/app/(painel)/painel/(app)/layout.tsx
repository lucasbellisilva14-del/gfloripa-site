import { redirect } from 'next/navigation'
import PainelNav from '@/components/painel/PainelNav'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { iaDisponivel } from '@/lib/painel/analise'

// Shell autenticado do painel. O proxy já redireciona quem não tem cookie,
// mas conferimos de novo aqui (defesa em profundidade).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const corretor = await getCorretorLogado()
  // sem corretor com cookie presente = conta desativada: sai limpando o cookie
  if (!corretor) redirect('/api/painel/logout?motivo=inativo')
  const db = await getDb()
  return (
    <div className="painel-shell" data-tema="auto">
      <PainelNav corretor={corretor} modoDados={db.modo} demoIa={!iaDisponivel()} />
      <main className="p-main">{children}</main>
    </div>
  )
}
