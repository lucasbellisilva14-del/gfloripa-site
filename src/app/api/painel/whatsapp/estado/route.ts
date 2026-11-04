import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirTokenPonte } from '@/lib/painel/whatsapp-token'
import { exigirCorretor } from '@/lib/painel/sessao'
import type { DiagnosticoWhatsapp, StatusWhatsapp } from '@/lib/painel/tipos'

const STATUS: StatusWhatsapp[] = ['desconectado', 'aguardando_qr', 'conectando', 'conectado']

// A ponte publica aqui o status da conexão e o QR; o painel só lê.
export async function POST(request: NextRequest) {
  const auth = exigirTokenPonte(request)
  if ('erro' in auth) return auth.erro
  let body: {
    status?: string
    qr?: string | null
    numero?: string | null
    detalhe?: string | null
    diagnostico?: Partial<DiagnosticoWhatsapp> | null
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const status = (STATUS as string[]).includes(String(body.status)) ? (body.status as StatusWhatsapp) : undefined
  const db = await getDb()
  const estado = await db.salvarEstadoWhatsapp(auth.corretor.id, {
    status,
    qr: body.qr === undefined ? undefined : body.qr ? String(body.qr).slice(0, 20000) : null,
    numero: body.numero === undefined ? undefined : body.numero ? String(body.numero).replace(/\D/g, '') : null,
    detalhe: body.detalhe === undefined ? undefined : body.detalhe ? String(body.detalhe).slice(0, 500) : null,
    diagnostico: body.diagnostico === undefined ? undefined : normalizarDiagnostico(body.diagnostico),
  })
  return Response.json({ ok: true, estado })
}

// Leitura pela tela do painel (cookie de sessão).
export async function GET() {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  const estado = await db.obterEstadoWhatsapp(auth.corretor.id)
  return Response.json({ estado })
}

const inteiro = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0)
const textoOuNulo = (v: unknown, max: number) => (v ? String(v).slice(0, max) : null)

// O serviço manda o que quiser; guardamos só os campos conhecidos, saneados.
function normalizarDiagnostico(d: Partial<DiagnosticoWhatsapp> | null): DiagnosticoWhatsapp | null {
  if (!d || typeof d !== 'object') return null
  return {
    versao: textoOuNulo(d.versao, 60),
    desde: textoOuNulo(d.desde, 40),
    vistas: inteiro(d.vistas),
    aceitas: inteiro(d.aceitas),
    enviadas: inteiro(d.enviadas),
    falhas_envio: inteiro(d.falhas_envio),
    ultima_vista_em: textoOuNulo(d.ultima_vista_em, 40),
    ultimo_erro: textoOuNulo(d.ultimo_erro, 300),
    painel_url: textoOuNulo(d.painel_url, 200),
  }
}
