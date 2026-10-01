import { type NextRequest } from 'next/server'
import { createLead, getCorretorById, getCorretorWhatsapp, getProperty } from '@/lib/jetimob'

// Fallback: WhatsApp geral da imobiliária, usado quando o imóvel não tem
// corretor responsável ou o corretor não tem WhatsApp cadastrado.
const WHATSAPP_GERAL = '5548984727799'

export async function POST(request: NextRequest) {
  let body: Record<string, string>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const nome = body.nome?.trim()
  const telefone = body.telefone?.trim()
  const email = body.email?.trim()
  const codigo = body.codigo?.trim()
  if (!nome || !telefone || !email) {
    return Response.json({ error: 'Preencha nome, telefone e e-mail' }, { status: 400 })
  }

  // Corretor responsável pelo imóvel → responsible do lead + destino do WhatsApp
  let responsibleEmail: string | undefined
  let whatsapp = WHATSAPP_GERAL
  let corretorNome: string | null = null
  if (codigo) {
    try {
      const property = await getProperty(codigo)
      const corretor = await getCorretorById(property?.id_corretor ?? null)
      if (corretor) {
        responsibleEmail = corretor.email
        corretorNome = corretor.nome
        whatsapp = getCorretorWhatsapp(corretor) ?? WHATSAPP_GERAL
      }
    } catch {
      // segue com o WhatsApp geral; o lead ainda é criado
    }
  }

  try {
    await createLead({
      full_name: nome,
      email,
      phone: telefone,
      message: body.mensagem || undefined,
      property_code: codigo || undefined,
      responsible: responsibleEmail,
      subject: body.assunto || (codigo ? `Interesse no imóvel ${codigo}` : 'Contato pelo site'),
      url: body.url || undefined,
      gclid: body.gclid || undefined,
      utm_source: body.utm_source || undefined,
      utm_medium: body.utm_medium || undefined,
      utm_campaign: body.utm_campaign || undefined,
    })
  } catch (err) {
    console.error('Erro ao criar lead na Jetimob:', err)
    // Não bloqueia o contato: devolve o WhatsApp mesmo se o CRM falhar
    return Response.json({ ok: false, whatsapp, corretor: corretorNome }, { status: 207 })
  }

  return Response.json({ ok: true, whatsapp, corretor: corretorNome })
}
