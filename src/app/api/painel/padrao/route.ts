import { type NextRequest } from 'next/server'
import { exigirCorretor } from '@/lib/painel/sessao'
import { getDb } from '@/lib/painel/db'
import { CHAVE_PADRAO, lerPadraoArquivo, obterPadraoAtendimento } from '@/lib/painel/padrao-atendimento'

export async function GET() {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  const atual = await obterPadraoAtendimento()
  return Response.json({ ...atual, arquivo: await lerPadraoArquivo() })
}

// Salva a versão editada do padrão (ou restaura o arquivo com texto vazio).
export async function PUT(request: NextRequest) {
  const auth = await exigirCorretor()
  if ('erro' in auth) return auth.erro
  let body: { texto?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const texto = String(body.texto ?? '')
  if (/[—–]/.test(texto)) {
    return Response.json({ error: 'O padrão não pode conter travessão (—) nem meia-risca (–).' }, { status: 400 })
  }
  const db = await getDb()
  await db.salvarConfig(CHAVE_PADRAO, texto, auth.corretor)
  return Response.json({ ok: true, origem: texto.trim() ? 'editado' : 'arquivo' })
}
