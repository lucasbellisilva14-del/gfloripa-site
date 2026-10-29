// Imóveis do corretor logado. Com JETIMOB_API_KEY, filtra getAllProperties()
// pelo id do corretor; sem chave (ou em caso de erro), usa os imóveis de
// demonstração para o painel continuar funcionando.

import { getAllProperties, getProperty, type Property } from '@/lib/jetimob'
import { IMOVEIS_DEMO } from './demo'

export function jetimobConfigurado(): boolean {
  return Boolean(process.env.JETIMOB_API_URL && process.env.JETIMOB_API_KEY)
}

export async function imoveisDoCorretor(corretorId: number): Promise<{ imoveis: Property[]; demo: boolean }> {
  if (!jetimobConfigurado()) return { imoveis: IMOVEIS_DEMO, demo: true }
  try {
    const todos = await getAllProperties()
    return { imoveis: todos.filter((p) => p.id_corretor === corretorId), demo: false }
  } catch (err) {
    console.error('Painel: erro ao buscar imóveis na Jetimob:', err)
    return { imoveis: IMOVEIS_DEMO, demo: true }
  }
}

// Busca vários imóveis por código (para a página do cliente). Em demo, usa a
// lista fixa; com chave, tenta a lista em cache e cai no detalhe se faltar.
export async function imoveisPorCodigos(codigos: string[]): Promise<Record<string, Property | null>> {
  const saida: Record<string, Property | null> = {}
  if (!codigos.length) return saida
  if (!jetimobConfigurado()) {
    for (const c of codigos) saida[c] = IMOVEIS_DEMO.find((p) => p.codigo.toUpperCase() === c.toUpperCase()) ?? null
    return saida
  }
  let todos: Property[] = []
  try {
    todos = await getAllProperties()
  } catch {
    // segue tentando um a um
  }
  await Promise.all(
    codigos.map(async (c) => {
      const naLista = todos.find((p) => p.codigo.toUpperCase() === c.toUpperCase())
      if (naLista) {
        saida[c] = naLista
        return
      }
      saida[c] = await getProperty(c).catch(() => null)
    })
  )
  return saida
}
