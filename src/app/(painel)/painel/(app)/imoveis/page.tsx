import ImoveisLista from '@/components/painel/ImoveisLista'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { imoveisDoCorretor } from '@/lib/painel/imoveis'

export default async function ImoveisPage() {
  const corretor = (await getCorretorLogado())!
  const { imoveis, demo } = await imoveisDoCorretor(corretor.id)
  return (
    <>
      <div className="p-head">
        <div>
          <h1>Meus imóveis</h1>
          <p>Imóveis sob sua responsabilidade no Jetimob (corretor #{corretor.id}).</p>
        </div>
        {demo && <span className="p-badge p-badge-demo">Dados de exemplo (sem JETIMOB_API_KEY)</span>}
      </div>
      <ImoveisLista imoveis={imoveis} />
    </>
  )
}
