import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { exigirGestor } from '@/lib/painel/sessao'
import { gerarHashSenha, gerarSenhaTemporaria, validarForcaSenha } from '@/lib/painel/senha'
import type { PapelCorretor } from '@/lib/painel/tipos'

export const USUARIO_REGEX = /^[a-z0-9][a-z0-9._-]{2,29}$/

// Equipe: só o gestor lista e cria corretores.
export async function GET() {
  const auth = await exigirGestor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  try {
    return Response.json({ corretores: await db.listarCorretores() })
  } catch (err) {
    return Response.json({ error: `Tabela de corretores indisponível: ${(err as Error).message}` }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await exigirGestor()
  if ('erro' in auth) return auth.erro
  let body: { usuario?: string; nome?: string; email?: string | null; papel?: string; jetimob_id?: number | string | null; senha?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }
  const usuario = String(body.usuario ?? '').trim().toLowerCase()
  const nome = String(body.nome ?? '').trim().slice(0, 80)
  if (!USUARIO_REGEX.test(usuario)) return Response.json({ error: 'Usuário inválido: use de 3 a 30 letras minúsculas, números, ponto, traço ou sublinhado.' }, { status: 400 })
  if (!nome) return Response.json({ error: 'Informe o nome.' }, { status: 400 })
  const papel: PapelCorretor = body.papel === 'gestor' ? 'gestor' : 'corretor'
  const jetimobId = body.jetimob_id === null || body.jetimob_id === undefined || body.jetimob_id === '' ? null : Number(body.jetimob_id)
  if (jetimobId !== null && !Number.isInteger(jetimobId)) return Response.json({ error: 'Id Jetimob inválido.' }, { status: 400 })

  let senha = typeof body.senha === 'string' ? body.senha : ''
  let temporaria: string | null = null
  if (!senha) {
    senha = gerarSenhaTemporaria()
    temporaria = senha
  } else {
    const problema = validarForcaSenha(senha)
    if (problema) return Response.json({ error: problema }, { status: 400 })
  }

  const db = await getDb()
  try {
    if (await db.obterCorretorPorUsuario(usuario)) return Response.json({ error: 'Já existe um corretor com esse usuário.' }, { status: 409 })
    const corretor = await db.criarCorretor({
      usuario,
      nome,
      email: body.email ? String(body.email).trim().slice(0, 120) : null,
      papel,
      jetimob_id: jetimobId,
      senha_hash: await gerarHashSenha(senha),
    })
    return Response.json({ ok: true, corretor, senha_temporaria: temporaria })
  } catch (err) {
    return Response.json({ error: `Não foi possível criar: ${(err as Error).message}` }, { status: 503 })
  }
}
