import WhatsappPainel from '@/components/painel/WhatsappPainel'
import { getCorretorLogado } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { tokenConfigurado } from '@/lib/painel/whatsapp-token'
import { urlPonte } from '@/lib/painel/whatsapp-ponte'
import { envioJetimobHabilitado } from '@/lib/painel/jetimob-escrita'

export default async function WhatsappPage() {
  const corretor = (await getCorretorLogado())!
  const db = await getDb()
  const [estado, chats, clientes] = await Promise.all([
    db.obterEstadoWhatsapp(corretor.id),
    db.listarChatsWhatsapp(corretor.id),
    db.listarClientes(corretor.id),
  ])
  const porId = new Map(clientes.map((c) => [c.id, c]))
  const resumo: Record<string, { nome: string; temperatura: string | null; nota: number | null; estagio: string | null }> = {}
  for (const ch of chats) {
    const c = ch.cliente_id ? porId.get(ch.cliente_id) : undefined
    if (c) resumo[ch.id] = { nome: c.nome, temperatura: c.temperatura, nota: c.nota_temperatura, estagio: c.estagio }
  }
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
        clientesIniciais={resumo}
        pontePronta={tokenConfigurado()}
        diretoConfigurado={Boolean(urlPonte())}
        hospedagemUrl={process.env.WHATSAPP_HOSPEDAGEM_URL?.trim() || null}
        envioJetimob={envioJetimobHabilitado()}
      />
    </>
  )
}
