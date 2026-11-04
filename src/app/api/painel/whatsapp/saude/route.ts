import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { saudePonte, urlPonte } from '@/lib/painel/whatsapp-ponte'

// Visão consolidada para a tela: o que o serviço disse por último (banco) e,
// quando há domínio público, o que ele responde agora (direto). A saúde
// direta fica em cache por alguns segundos; ?fresco=1 força nova consulta.
export async function GET(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  const fresco = request.nextUrl.searchParams.get('fresco') === '1'
  const [estado, saude] = await Promise.all([db.obterEstadoWhatsapp(auth.corretor.id), saudePonte(fresco)])
  return Response.json({
    estado,
    saude,
    direto_configurado: Boolean(urlPonte()),
    url_direta: urlPonte(),
    agora: new Date().toISOString(),
  })
}
