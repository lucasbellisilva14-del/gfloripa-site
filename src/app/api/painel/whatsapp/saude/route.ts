import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { saudePonte, urlPonte } from '@/lib/painel/whatsapp-ponte'

// Visão consolidada para a tela: o que o serviço disse por último (banco) e,
// quando há domínio público, o que ele responde agora (direto).
export async function GET() {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  const [estado, saude] = await Promise.all([db.obterEstadoWhatsapp(auth.corretor.id), saudePonte()])
  return Response.json({ estado, saude, direto_configurado: Boolean(urlPonte()), agora: new Date().toISOString() })
}
