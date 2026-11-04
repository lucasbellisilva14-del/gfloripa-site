// Adaptador Supabase via PostgREST (REST), sem SDK: o projeto evita
// dependências novas e a API REST cobre tudo que o painel precisa.
// Usa a service role key: esta camada só roda no servidor, atrás do login.

import type { PainelDb, PatchEstadoWhatsapp } from './db'
import { normalizarTelefone, ordenarClientes } from './db'
import type { Analise, ChatWhatsapp, Cliente, ComandoWhatsapp, Conversa, EstadoWhatsapp, ImovelInteresse, Lembrete, MensagemRecebida, MensagemWhatsapp } from './tipos'

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

async function rest<T>(
  tabela: string,
  init: RequestInit & { query?: string; retorno?: boolean; prefer?: string } = {}
): Promise<T> {
  const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const url = `${base}/rest/v1/${tabela}${init.query ? `?${init.query}` : ''}`
  const prefer = init.prefer ?? (init.retorno === false ? 'return=minimal' : 'return=representation')
  const res = await fetch(url, {
    ...init,
    headers: cabecalhos({ Prefer: prefer }),
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
          tipo_origem: input.tipo_origem ?? 'ia',
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

    // --- ponte do WhatsApp ---
    async obterEstadoWhatsapp(corretorId) {
      const linhas = await rest<EstadoWhatsapp[]>('whatsapp_estado', {
        query: `select=*&corretor_id=eq.${q(corretorId)}&limit=1`,
      })
      return linhas[0] ?? null
    },
    async salvarEstadoWhatsapp(corretorId, patch: PatchEstadoWhatsapp) {
      const atual = await this.obterEstadoWhatsapp(corretorId)
      const corpo = {
        corretor_id: corretorId,
        status: patch.status ?? atual?.status ?? 'desconectado',
        qr: patch.qr !== undefined ? patch.qr : (atual?.qr ?? null),
        numero: patch.numero !== undefined ? patch.numero : (atual?.numero ?? null),
        detalhe: patch.detalhe !== undefined ? patch.detalhe : (atual?.detalhe ?? null),
        diagnostico: patch.diagnostico !== undefined ? patch.diagnostico : (atual?.diagnostico ?? null),
        // comando não entra no upsert do estado: tem rotas próprias
        comando: atual?.comando ?? null,
        comando_em: atual?.comando_em ?? null,
        atualizado_em: new Date().toISOString(),
      }
      const linhas = await rest<EstadoWhatsapp[]>('whatsapp_estado', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify(corpo),
      })
      return linhas[0] ?? (corpo as EstadoWhatsapp)
    },
    async obterSessaoWhatsapp(corretorId) {
      const linhas = await rest<{ dados: unknown }[]>('whatsapp_sessao', {
        query: `select=dados&corretor_id=eq.${q(corretorId)}&limit=1`,
      })
      return linhas[0]?.dados ?? null
    },
    async salvarSessaoWhatsapp(corretorId, dados) {
      await rest('whatsapp_sessao', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        retorno: false,
        body: JSON.stringify({ corretor_id: corretorId, dados, atualizado_em: new Date().toISOString() }),
      })
    },
    async apagarSessaoWhatsapp(corretorId) {
      await rest('whatsapp_sessao', { method: 'DELETE', query: `corretor_id=eq.${q(corretorId)}`, retorno: false })
    },
    async registrarMensagensWhatsapp(corretorId, mensagens) {
      const porChat = new Map<string, MensagemRecebida[]>()
      for (const m of mensagens) {
        const lista = porChat.get(m.wa_chat_id) ?? []
        lista.push(m)
        porChat.set(m.wa_chat_id, lista)
      }
      let novas = 0
      for (const [waChatId, lista] of porChat) {
        const achados = await rest<ChatWhatsapp[]>('whatsapp_chats', {
          query: `select=*&corretor_id=eq.${q(corretorId)}&wa_chat_id=eq.${q(waChatId)}&limit=1`,
        })
        let chat = achados[0]
        if (!chat) {
          const criados = await rest<ChatWhatsapp[]>('whatsapp_chats', {
            method: 'POST',
            body: JSON.stringify({
              corretor_id: corretorId,
              wa_chat_id: waChatId,
              nome: lista.find((m) => m.nome)?.nome ?? null,
              telefone: normalizarTelefone(waChatId.split('@')[0]),
            }),
          })
          chat = criados[0]
        }
        if (!chat) continue
        // ignore-duplicates: mensagem repetida (mesmo wa_id) não é inserida de novo
        const inseridas = await rest<MensagemWhatsapp[]>('whatsapp_mensagens', {
          method: 'POST',
          query: 'on_conflict=chat_id,wa_id',
          prefer: 'resolution=ignore-duplicates,return=representation',
          body: JSON.stringify(
            lista.map((m) => ({
              chat_id: chat.id,
              corretor_id: corretorId,
              wa_id: m.wa_id,
              direcao: m.direcao,
              autor: m.autor,
              texto: m.texto,
              data: m.data,
            }))
          ),
        })
        if (!inseridas.length) continue
        novas += inseridas.length
        const maisRecente = inseridas.reduce((a, b) => (a.data > b.data ? a : b))
        const nome = chat.nome ?? lista.find((m) => m.nome)?.nome ?? null
        await rest('whatsapp_chats', {
          method: 'PATCH',
          query: `id=eq.${q(chat.id)}`,
          retorno: false,
          body: JSON.stringify({
            total_mensagens: chat.total_mensagens + inseridas.length,
            ultima_mensagem_em:
              !chat.ultima_mensagem_em || maisRecente.data > chat.ultima_mensagem_em ? maisRecente.data : chat.ultima_mensagem_em,
            ultimo_texto: maisRecente.texto.slice(0, 160),
            nome,
          }),
        })
      }
      return novas
    },
    async listarChatsWhatsapp(corretorId, incluirArquivados = false) {
      const filtro = incluirArquivados ? '' : '&arquivado=is.false'
      return rest<ChatWhatsapp[]>('whatsapp_chats', {
        query: `select=*&corretor_id=eq.${q(corretorId)}${filtro}&order=ultima_mensagem_em.desc.nullslast`,
      })
    },
    async obterChatWhatsapp(id) {
      const linhas = await rest<ChatWhatsapp[]>('whatsapp_chats', { query: `select=*&id=eq.${q(id)}&limit=1` })
      return linhas[0] ?? null
    },
    async listarMensagensDoChat(chatId, limite = 500) {
      return rest<MensagemWhatsapp[]>('whatsapp_mensagens', {
        query: `select=*&chat_id=eq.${q(chatId)}&order=data.asc&limit=${q(limite)}`,
      })
    },
    async atualizarChatWhatsapp(id, patch) {
      const linhas = await rest<ChatWhatsapp[]>('whatsapp_chats', {
        method: 'PATCH',
        query: `id=eq.${q(id)}`,
        body: JSON.stringify(patch),
      })
      return linhas[0] ?? null
    },
    async definirComandoWhatsapp(corretorId, comando) {
      // garante a linha sem tocar em atualizado_em (que é o pulso do serviço):
      // insere só se não existir, com data antiga para não valer como sinal de vida
      await rest('whatsapp_estado', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=minimal',
        retorno: false,
        body: JSON.stringify({ corretor_id: corretorId, status: 'desconectado', atualizado_em: new Date(0).toISOString() }),
      })
      await rest('whatsapp_estado', {
        method: 'PATCH',
        query: `corretor_id=eq.${q(corretorId)}`,
        retorno: false,
        body: JSON.stringify({ comando, comando_em: comando ? new Date().toISOString() : null }),
      })
    },
    async consumirComandoWhatsapp(corretorId) {
      // lê e limpa na mesma operação: só limpa se ainda for o mesmo comando,
      // então duas instâncias do serviço não executam o mesmo pedido
      const linhas = await rest<{ comando: ComandoWhatsapp | null }[]>('whatsapp_estado', {
        query: `select=comando&corretor_id=eq.${q(corretorId)}&limit=1`,
      })
      const comando = linhas[0]?.comando ?? null
      if (!comando) return null
      const limpas = await rest<{ corretor_id: number }[]>('whatsapp_estado', {
        method: 'PATCH',
        query: `corretor_id=eq.${q(corretorId)}&comando=eq.${q(comando)}`,
        body: JSON.stringify({ comando: null, comando_em: null }),
      })
      return limpas.length ? comando : null
    },
  }
}
