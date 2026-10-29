// Leitura do padrão de atendimento que alimenta o system prompt da análise.
// A versão base é o arquivo versionado src/painel/padrao-atendimento.md; se o
// corretor editar em /painel/configuracoes, a versão editada fica salva na
// configuração "padrao_atendimento" do banco e passa a valer.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getDb } from './db'

export const CHAVE_PADRAO = 'padrao_atendimento'

let cacheArquivo: string | null = null

export async function lerPadraoArquivo(): Promise<string> {
  if (cacheArquivo) return cacheArquivo
  const arquivo = path.join(process.cwd(), 'src', 'painel', 'padrao-atendimento.md')
  cacheArquivo = await fs.readFile(arquivo, 'utf8')
  return cacheArquivo
}

export async function obterPadraoAtendimento(): Promise<{ texto: string; origem: 'arquivo' | 'editado' }> {
  const db = await getDb()
  const editado = await db.obterConfig(CHAVE_PADRAO).catch(() => null)
  if (editado && editado.trim()) return { texto: editado, origem: 'editado' }
  return { texto: await lerPadraoArquivo(), origem: 'arquivo' }
}
