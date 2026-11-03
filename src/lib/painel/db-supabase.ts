// Adaptador Supabase via PostgREST (REST), sem SDK: o projeto evita
// dependências novas e a API REST cobre tudo que o painel precisa.
// Usa a service role key: esta camada só roda no servidor, atrás do login.

import type { PainelDb } from './db'
import { normalizarTelefone, ordenarClientes } from './db'
import type { Analise, Cliente, Conversa, ImovelInteresse, Lembrete } from './tipos'

type Linha = Record<string, unknown>

function cabecalhos(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function rest<T>(tabela: string, init: RequestInit & { query?: string; retorno?: boolean } = {}): Promise<T> {
  const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const url = `${base}/rest/v1/${tabela}${init.query ? `?${init.query}` : ''}`
  const res = await fetch(url, {
    ...init,
    headers: cabecalhos(init.retorno === false ? { Prefer: 'return=minimal' } : { Prefer: 'return=representation' }),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Supabase ${init.method ?? 'GET'} ${tabela}: ${res.status} ${await res.text().catch(() => '')}`)
  }
  if (res.status === 204 || init.retorno === false) return undefined as T
  return (await res.json()) as T
}

const q = (v: string | number) => encodeURIComponent(String(v))

function paraAnalise(l: Linha): Analise {
  return {
    ...(l as unknown as Analise),
    resultado: typeof l.resultado === 'string' ? JSON.parse(l.resultado) : (l.resultado as Analise['resultado']),
    custo_usd: Number(l.custo_usd ?? 0),
  }
}

export function criarDbSupabase(): PainelDb {
  return {
    modo: 'supabase',

    async listarClientes(corretorId) {
      const filtro = corretorId ? `&corretor_id=eq.${q(corretorId)}` : ''
      const linhas = await rest<Cliente[]>('clientes', { query: `select=*${filtro}&order=atualizado_em.desc` })
      return ordenarClientes(linhas)
    },
    async obterCliente(id) {
      const linhas = await rest<Cliente[]>('clientes', { query: `select=*&id=eq.${q(id)}&limit=1` })
      return linhas[0] ?? null
    },
    async buscarClientePorTelefone(telefone, corretorId) {
      const t = normalizarTelefone(telefone)
      if (!t) return null
      const linhas = await rest<Cliente[]>('clientes', {
        query: `select=*&corretor_id=eq.${q(corretorId)}&telefone_normalizado=eq.${q(t)}&limit=1`,
      })
      return linhas[0] ?? null
    },
    async buscarClientePorNome(nome, corretorId) {
      const n = nome.trim()
      if (!n) return null
      const linhas = await rest<Cliente[]>('clientes', {
        query: `select=*&corretor_id=eq.${q(corretorId)}&nome=ilike.${q(n)}&limit=1`,
      })
      return linhas[0] ?? null
    },
    async criarCliente(input) {
      const linhas = await rest<Cliente[]>('clientes', {
        method: 'POST',
        body: JSON.stringify({
          corretor_id: input.corretor_id,
          nome: input.nome.trim() || 'Cliente sem nome',
          telefone: input.telefone ?? null,
          telefone_normalizado: normalizarTelefone(input.telefone),
          email: input.email ?? null,
          tipo: input.tipo ?? 'indefinido',
          origem: input.origem ?? null,
        }),
      })
      return linhas[0]
    },
    async atualizarCliente(id, patch) {
      const corpo: Linha = { ...patch, atualizado_em: new Date().toISOString() }
      if ('telefone' in patch) corpo.telefone_normalizado = normalizarTelefone(patch.telefone)
      const linhas = await rest<Cliente[]>('clientes', { method: 'PATCH', query: `id=eq.${q(id)}`, body: JSON.stringify(corpo) })
      return linhas[0] ?? null
    },

    async criarConversa(input) {
      const linhas = await rest<Conversa[]>('conversas', { method: 'POST', body: JSON.stringify({ ...input, nome_arquivo: input.nome_arquivo ?? null }) })
      return linhas[0]
    },
    async obterConversa(id) {
      const linhas = await rest<Conversa[]>('conversas', { query: `select=*&id=eq.${q(id)}&limit=1` })
      return linhas[0] ?? null
    },
    async listarConversasDoCliente(clienteId) {
      return rest<Conversa[]>('conversas', { query: `select=*&cliente_id=eq.${q(clienteId)}&order=data_conversa.desc` })
    },

    async criarAnalise(input) {
      const linhas = await rest<Linha[]>('analises', { method: 'POST', body: JSON.stringify(input) })
      return paraAnalise(linhas[0])
    },
    async obterAnalise(id) {
      const linhas = await rest<Linha[]>('analises', { query: `select=*&id=eq.${q(id)}&limit=1` })
      return linhas[0] ? paraAnalise(linhas[0]) : null
    },
    async listarAnalisesDoCliente(clienteId) {
      const linhas = await rest<Linha[]>('analises', { query: `select=*&cliente_id=eq.${q(clienteId)}&order=criado_em.desc` })
      return linhas.map(paraAnalise)
    },
    async listarAnalisesRecentes(corretorId, limite) {
      const linhas = await rest<Linha[]>('analises', {
        query: `select=*&corretor_id=eq.${q(corretorId)}&order=criado_em.desc&limit=${q(limite)}`,
      })
      return linhas.map(paraAnalise)
    },
    async contarAnalisesDesde(corretorId, desdeIso) {
      const linhas = await rest<{ id: string }[]>('analises', {
        query: `select=id&corretor_id=eq.${q(corretorId)}&criado_em=gte.${q(desdeIso)}`,
      })
      return linhas.length
    },

    async criarLembrete(input) {
      const linhas = await rest<Lembrete[]>('lembretes', {
        method: 'POST',
        body: JSON.stringify({ ...input, cliente_id: input.cliente_id ?? null, descricao: input.descricao ?? null, analise_id: input.analise_id ?? null, status: 'pendente' }),
      })
      return linhas[0]
    },
    async listarLembretes(filtro) {
      const partes = ['select=*']
      if (filtro.corretor_id) partes.push(`corretor_id=eq.${q(filtro.corretor_id)}`)
      if (filtro.cliente_id) partes.push(`cliente_id=eq.${q(filtro.cliente_id)}`)
      if (filtro.status) partes.push(`status=eq.${q(filtro.status)}`)
      partes.push('order=data.asc')
      return rest<Lembrete[]>('lembretes', { query: partes.join('&') })
    },
    async atualizarLembrete(id, patch) {
      const linhas = await rest<Lembrete[]>('lembretes', {
        method: 'PATCH',
        query: `id=eq.${q(id)}`,
        body: JSON.stringify({ ...patch, atualizado_em: new Date().toISOString() }),
      })
      return linhas[0] ?? null
    },

    async adicionarImovelInteresse(clienteId, codigo, origem) {
      const existentes = await rest<ImovelInteresse[]>('imoveis_interesse', {
        query: `select=*&cliente_id=eq.${q(clienteId)}&codigo_imovel=eq.${q(codigo)}&limit=1`,
      })
      if (existentes[0]) return existentes[0]
      const linhas = await rest<ImovelInteresse[]>('imoveis_interesse', {
        method: 'POST',
        body: JSON.stringify({ cliente_id: clienteId, codigo_imovel: codigo, origem }),
      })
      return linhas[0]
    },
    async listarImoveisInteresse(clienteId) {
      return rest<ImovelInteresse[]>('imoveis_interesse', { query: `select=*&cliente_id=eq.${q(clienteId)}&order=criado_em.desc` })
    },

    async obterConfig(chave) {
      const linhas = await rest<{ valor: string }[]>('painel_config', { query: `select=valor&chave=eq.${q(chave)}&limit=1` })
      return linhas[0]?.valor ?? null
    },
    async salvarConfig(chave, valor, corretor) {
      // upsert pela chave primária
      await fetch(`${(process.env.SUPABASE_URL ?? '').replace(/\/$/, '')}/rest/v1/painel_config`, {
        method: 'POST',
        headers: cabecalhos({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ chave, valor, atualizado_por: corretor?.id ?? null, atualizado_em: new Date().toISOString() }),
      }).then((res) => {
        if (!res.ok) throw new Error(`Supabase upsert painel_config: ${res.status}`)
      })
    },
  }
}
