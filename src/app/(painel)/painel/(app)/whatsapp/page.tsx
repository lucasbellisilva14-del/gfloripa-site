import WhatsappPainel from '@/components/painel/WhatsappPainel'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { tokenConfigurado } from '@/lib/painel/whatsapp-token'
import { envioJetimobHabilitado } from '@/lib/painel/jetimob-escrita'

export default async function WhatsappPage() {
  const corretor = (await getCorretorLogado())!
  const db = await getDb()
  const [estado, chats] = await Promise.all([
    db.obterEstadoWhatsapp(corretor.id),
    db.listarChatsWhatsapp(corretor.id),
  ])
  return (
    <>
      <div className="p-head">
        <div>
          <h1>WhatsApp</h1>
          <p>Suas conversas entram sozinhas no painel e a I.A. analisa quando você pedir. O painel só lê: quem responde é você, pelo WhatsApp de sempre.</p>
        </div>
      </div>
      <WhatsappPainel
        estadoInicial={estado}
        chatsIniciais={chats}
        pontePronta={tokenConfigurado()}
        envioJetimob={envioJetimobHabilitado()}
      />
    </>
  )
}
