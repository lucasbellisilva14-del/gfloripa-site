import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/painel/db'
import { esquecerCacheAtivo, exigirGestor } from '@/lib/painel/sessao'
import { gerarHashSenha, gerarSenhaTemporaria, validarForcaSenha } from '@/lib/painel/senha'
import type { PatchCorretor } from '@/lib/painel/tipos'

// Gestor edita um corretor: nome, e-mail, papel, ativo, id Jetimob e senha.
// Ele não pode se desativar nem deixar de ser gestor, para a porta nunca
// ficar trancada por engano.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirGestor()
  if ('erro' in auth) return auth.erro
  const { id: idBruto } = await params
  const id = Number(idBruto)
  if (!Number.isInteger(id)) return Response.json({ error: 'Id inválido' }, { status: 400 })

  let body: {
    nome?: string
    email?: string | null
    papel?: string
    ativo?: boolean
    jetimob_id?: number | string | null
    nova_senha?: string
    gerar_senha?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const patch: PatchCorretor = {}
  if (typeof body.nome === 'string' && body.nome.trim()) patch.nome = body.nome.trim().slice(0, 80)
  if (body.email !== undefined) patch.email = body.email ? String(body.email).trim().slice(0, 120) : null
  if (body.papel === 'gestor' || body.papel === 'corretor') patch.papel = body.papel
  if (typeof body.ativo === 'boolean') patch.ativo = body.ativo
  if (body.jetimob_id !== undefined) {
    const j = body.jetimob_id === null || body.jetimob_id === '' ? null : Number(body.jetimob_id)
    if (j !== null && !Number.isInteger(j)) return Response.json({ error: 'Id Jetimob inválido.' }, { status: 400 })
    patch.jetimob_id = j
  }

  const souEu = id === auth.corretor.id
  if (souEu && patch.ativo === false) return Response.json({ error: 'Você não pode desativar o seu próprio acesso.' }, { status: 400 })
  if (souEu && patch.papel === 'corretor') return Response.json({ error: 'Você não pode deixar de ser gestor pela própria conta.' }, { status: 400 })

  let temporaria: string | null = null
  if (body.gerar_senha) {
    temporaria = gerarSenhaTemporaria()
    patch.senha_hash = await gerarHashSenha(temporaria)
  } else if (typeof body.nova_senha === 'string' && body.nova_senha) {
    const problema = validarForcaSenha(body.nova_senha)
    if (problema) return Response.json({ error: problema }, { status: 400 })
    patch.senha_hash = await gerarHashSenha(body.nova_senha)
  }

  if (!Object.keys(patch).length) return Response.json({ error: 'Nada para alterar.' }, { status: 400 })

  const db = await getDb()
  try {
    const corretor = await db.atualizarCorretor(id, patch)
    if (!corretor) return Response.json({ error: 'Corretor não encontrado' }, { status: 404 })
    if (patch.ativo !== undefined) esquecerCacheAtivo(id) // bloqueio vale na hora
    return Response.json({ ok: true, corretor, senha_temporaria: temporaria })
  } catch (err) {
    return Response.json({ error: `Não foi possível salvar: ${(err as Error).message}` }, { status: 503 })
  }
}
