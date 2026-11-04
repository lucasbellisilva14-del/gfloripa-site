import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirCorretor } from '@/lib/painel/sessao'
import { exigirTokenPonte } from '@/lib/painel/whatsapp-token'
import { comandoDireto, urlPonte } from '@/lib/painel/whatsapp-ponte'
import { COMANDOS_WHATSAPP, type ComandoWhatsapp } from '@/lib/painel/tipos'

// A tela pede um comando (cookie de sessão). Se o serviço tiver domínio
// público configurado, executa na hora; senão deixa na fila para o serviço
// pegar em até cinco segundos.
export async function POST(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  let body: { comando?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const comando = body.comando as ComandoWhatsapp
  if (!COMANDOS_WHATSAPP.includes(comando)) return Response.json({ error: 'Comando inválido' }, { status: 400 })

  const db = await getDb()
  if (await comandoDireto(comando)) {
    return Response.json({ ok: true, via: 'direto' })
  }
  await db.definirComandoWhatsapp(auth.corretor.id, comando)
  // "pulso" pela fila só vale se o serviço estiver vivo para responder
  return Response.json({ ok: true, via: 'fila', direto_configurado: Boolean(urlPonte()) })
}

// O serviço busca o próximo comando (token). Lê e limpa de uma vez.
export async function GET(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  const comando = await db.consumirComandoWhatsapp(auth.corretor.id)
  return Response.json({ comando })
}
