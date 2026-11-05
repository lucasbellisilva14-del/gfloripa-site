import { getDb } from '@/lib/painel/db'
import { exigirGestor } from '@/lib/painel/sessao'
import { montarVisaoEquipe } from '@/lib/painel/equipe'
import { gerarRelatorioEquipe, obterRelatorioGuardado, salvarRelatorio } from '@/lib/painel/relatorio-equipe'

export const maxDuration = 60

// Relatório da equipe pela I.A. (só gestor). GET devolve o último guardado;
// POST gera um novo e guarda.
export async function GET() {
  const auth = await exigirGestor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  return Response.json({ relatorio: await obterRelatorioGuardado(db) })
}

export async function POST() {
  const auth = await exigirGestor()
  if ('erro' in auth) return auth.erro
  const db = await getDb()
  try {
    const visao = await montarVisaoEquipe(db)
    const guardado = await gerarRelatorioEquipe(visao)
    await salvarRelatorio(db, guardado)
    return Response.json({ ok: true, relatorio: guardado })
  } catch (err) {
    console.error('Painel: erro ao gerar relatório da equipe:', err)
    return Response.json({ error: (err as Error).message || 'Não foi possível gerar o relatório' }, { status: 502 })
  }
}
