// Imóveis do corretor logado. Com JETIMOB_API_KEY, filtra getAllProperties()
// pelo id do corretor; sem chave (ou em caso de erro), usa os imóveis de
// demonstração para o painel continuar funcionando.

import { getAllProperties, getCorretores, getProperty, type Property } from '@/lib/jetimob'
import { IMOVEIS_DEMO } from './demo'
import type { CorretorLogado } from './tipos'

export function jetimobConfigurado(): boolean {
  return Boolean(process.env.JETIMOB_API_URL && process.env.JETIMOB_API_KEY)
}

const simples = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().split(/\s+/)[0] ?? ''

// Id do corretor no Jetimob: o ligado pelo gestor (jetimob_id); senão, tenta
// casar pelo primeiro nome na lista de corretores da API; senão, o próprio id.
export async function jetimobIdDoCorretor(corretor: CorretorLogado): Promise<number> {
  if (corretor.jetimob_id) return corretor.jetimob_id
  if (!jetimobConfigurado()) return corretor.id
  try {
    const lista = await getCorretores()
    const alvo = simples(corretor.nome)
    const iguais = lista.filter((c) => simples(c.nome ?? '') === alvo)
    if (iguais.length === 1) return iguais[0].id
  } catch {
    // sem lista: segue com o id interno
  }
  return corretor.id
}

export async function imoveisDoCorretor(corretor: CorretorLogado): Promise<{ imoveis: Property[]; demo: boolean; jetimobId: number }> {
  if (!jetimobConfigurado()) return { imoveis: IMOVEIS_DEMO, demo: true, jetimobId: corretor.id }
  try {
    const jetimobId = await jetimobIdDoCorretor(corretor)
    const todos = await getAllProperties()
    return { imoveis: todos.filter((p) => p.id_corretor === jetimobId), demo: false, jetimobId }
  } catch (err) {
    console.error('Painel: erro ao buscar imóveis na Jetimob:', err)
    return { imoveis: IMOVEIS_DEMO, demo: true, jetimobId: corretor.id }
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
