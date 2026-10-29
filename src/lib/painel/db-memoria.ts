// Adaptador em memória (com persistência opcional em JSON) para rodar o
// painel sem Supabase. Carrega dados de demonstração na primeira execução.
// Em ambiente serverless o disco é somente leitura: a persistência falha em
// silêncio e os dados vivem só enquanto a instância estiver quente.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { PainelDb } from './db'
import { agoraIso, novoId, normalizarTelefone, ordenarClientes } from './db'
import type { Analise, Cliente, Conversa, ImovelInteresse, Lembrete } from './tipos'
import { dadosDemo } from './demo'

type Estado = {
  clientes: Cliente[]
  conversas: Conversa[]
  analises: Analise[]
  lembretes: Lembrete[]
  imoveis_interesse: ImovelInteresse[]
  config: Record<string, string>
}

const ARQUIVO = path.join(process.cwd(), '.painel-dados', 'dados.json')

async function carregar(): Promise<Estado> {
  try {
    const bruto = await fs.readFile(ARQUIVO, 'utf8')
    const estado = JSON.parse(bruto) as Estado
    if (Array.isArray(estado.clientes)) return { ...estado, config: estado.config ?? {} }
  } catch {
    // sem arquivo: usa a demonstração
  }
  return dadosDemo()
}

async function salvar(estado: Estado): Promise<void> {
  try {
    await fs.mkdir(path.dirname(ARQUIVO), { recursive: true })
    await fs.writeFile(ARQUIVO, JSON.stringify(estado, null, 2), 'utf8')
  } catch {
    // disco somente leitura (Vercel) ou sem permissão: segue só em memória
  }
}

export async function criarDbMemoria(): Promise<PainelDb> {
  const estado = await carregar()
  const persistir = () => salvar(estado)

  const db: PainelDb = {
    modo: 'memoria',

    async listarClientes(corretorId) {
      return ordenarClientes(estado.clientes.filter((c) => !corretorId || c.corretor_id === corretorId))
    },
    async obterCliente(id) {
      return estado.clientes.find((c) => c.id === id) ?? null
    },
    async buscarClientePorTelefone(telefone, corretorId) {
      const t = normalizarTelefone(telefone)
      if (!t) return null
      return estado.clientes.find((c) => c.corretor_id === corretorId && normalizarTelefone(c.telefone) === t) ?? null
    },
    async buscarClientePorNome(nome, corretorId) {
      const n = nome.trim().toLowerCase()
      if (!n) return null
      return estado.clientes.find((c) => c.corretor_id === corretorId && c.nome.trim().toLowerCase() === n) ?? null
    },
    async criarCliente(input) {
      const agora = agoraIso()
      const cliente: Cliente = {
        id: novoId(),
        corretor_id: input.corretor_id,
        nome: input.nome.trim() || 'Cliente sem nome',
        telefone: input.telefone ?? null,
        email: input.email ?? null,
        tipo: input.tipo ?? 'indefinido',
        origem: input.origem ?? null,
        temperatura: null,
        nota_temperatura: null,
        estagio: null,
        resumo: null,
        ultima_interacao: null,
        criado_em: agora,
        atualizado_em: agora,
      }
      estado.clientes.push(cliente)
      await persistir()
      return cliente
    },
    async atualizarCliente(id, patch) {
      const c = estado.clientes.find((x) => x.id === id)
      if (!c) return null
      Object.assign(c, patch, { atualizado_em: agoraIso() })
      await persistir()
      return c
    },

    async criarConversa(input) {
      const conversa: Conversa = {
        id: novoId(),
        cliente_id: input.cliente_id,
        corretor_id: input.corretor_id,
        texto: input.texto,
        data_conversa: input.data_conversa,
        origem: input.origem,
        nome_arquivo: input.nome_arquivo ?? null,
        criado_em: agoraIso(),
      }
      estado.conversas.push(conversa)
      await persistir()
      return conversa
    },
    async obterConversa(id) {
      return estado.conversas.find((c) => c.id === id) ?? null
    },
    async listarConversasDoCliente(clienteId) {
      return estado.conversas
        .filter((c) => c.cliente_id === clienteId)
        .sort((a, b) => b.data_conversa.localeCompare(a.data_conversa))
    },

    async criarAnalise(input) {
      const analise: Analise = { id: novoId(), criado_em: agoraIso(), ...input }
      estado.analises.push(analise)
      await persistir()
      return analise
    },
    async obterAnalise(id) {
      return estado.analises.find((a) => a.id === id) ?? null
    },
    async listarAnalisesDoCliente(clienteId) {
      return estado.analises.filter((a) => a.cliente_id === clienteId).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    },
    async listarAnalisesRecentes(corretorId, limite) {
      return estado.analises
        .filter((a) => a.corretor_id === corretorId)
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
        .slice(0, limite)
    },
    async contarAnalisesDesde(corretorId, desdeIso) {
      return estado.analises.filter((a) => a.corretor_id === corretorId && a.criado_em >= desdeIso).length
    },

    async criarLembrete(input) {
      const agora = agoraIso()
      const lembrete: Lembrete = {
        id: novoId(),
        cliente_id: input.cliente_id ?? null,
        corretor_id: input.corretor_id,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        data: input.data,
        status: 'pendente',
        origem: input.origem,
        analise_id: input.analise_id ?? null,
        criado_em: agora,
        atualizado_em: agora,
      }
      estado.lembretes.push(lembrete)
      await persistir()
      return lembrete
    },
    async listarLembretes(filtro) {
      return estado.lembretes
        .filter(
          (l) =>
            (!filtro.corretor_id || l.corretor_id === filtro.corretor_id) &&
            (!filtro.cliente_id || l.cliente_id === filtro.cliente_id) &&
            (!filtro.status || l.status === filtro.status)
        )
        .sort((a, b) => a.data.localeCompare(b.data))
    },
    async atualizarLembrete(id, patch) {
      const l = estado.lembretes.find((x) => x.id === id)
      if (!l) return null
      Object.assign(l, patch, { atualizado_em: agoraIso() })
      await persistir()
      return l
    },

    async adicionarImovelInteresse(clienteId, codigo, origem) {
      const existente = estado.imoveis_interesse.find((i) => i.cliente_id === clienteId && i.codigo_imovel === codigo)
      if (existente) return existente
      const item: ImovelInteresse = { id: novoId(), cliente_id: clienteId, codigo_imovel: codigo, origem, criado_em: agoraIso() }
      estado.imoveis_interesse.push(item)
      await persistir()
      return item
    },
    async listarImoveisInteresse(clienteId) {
      return estado.imoveis_interesse.filter((i) => i.cliente_id === clienteId)
    },

    async obterConfig(chave) {
      return estado.config[chave] ?? null
    },
    async salvarConfig(chave, valor) {
      estado.config[chave] = valor
      await persistir()
    },
  }
  return db
}
