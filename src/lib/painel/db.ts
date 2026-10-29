// Camada de acesso a dados do painel.
//
// Com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY definidos, usa o Postgres do
// Supabase via PostgREST (sem dependência nova: só fetch). Sem elas, usa um
// adaptador em memória com dados de demonstração, opcionalmente persistido
// em arquivo JSON local (.painel-dados/dados.json, ignorado pelo git), para
// o painel funcionar em dev e na nuvem sem credenciais.
//
// Todas as funções recebem/retornam os tipos de ./tipos. As tabelas e colunas
// espelham supabase/migrations/*.sql.

import type {
  Analise,
  AnaliseResultado,
  Cliente,
  Conversa,
  CorretorLogado,
  ImovelInteresse,
  Lembrete,
  StatusLembrete,
  Temperatura,
  Estagio,
  TipoCliente,
} from './tipos'

export type NovoCliente = {
  corretor_id: number
  nome: string
  telefone?: string | null
  email?: string | null
  tipo?: TipoCliente
  origem?: string | null
}

export type PatchCliente = Partial<
  Pick<
    Cliente,
    'nome' | 'telefone' | 'email' | 'tipo' | 'origem' | 'temperatura' | 'nota_temperatura' | 'estagio' | 'resumo' | 'ultima_interacao'
  >
>

export type NovaConversa = {
  cliente_id: string
  corretor_id: number
  texto: string
  data_conversa: string
  origem: string
  nome_arquivo?: string | null
}

export type NovaAnalise = {
  conversa_id: string
  cliente_id: string
  corretor_id: number
  resultado: AnaliseResultado
  modelo: string
  tokens_entrada: number
  tokens_saida: number
  custo_usd: number
  demo: boolean
}

export type NovoLembrete = {
  cliente_id?: string | null
  corretor_id: number
  titulo: string
  descricao?: string | null
  data: string
  origem: 'ia' | 'manual'
  analise_id?: string | null
}

export type FiltroLembretes = {
  corretor_id?: number
  cliente_id?: string
  status?: StatusLembrete
}

export interface PainelDb {
  readonly modo: 'supabase' | 'memoria'

  listarClientes(corretorId?: number): Promise<Cliente[]>
  obterCliente(id: string): Promise<Cliente | null>
  buscarClientePorTelefone(telefone: string, corretorId: number): Promise<Cliente | null>
  buscarClientePorNome(nome: string, corretorId: number): Promise<Cliente | null>
  criarCliente(input: NovoCliente): Promise<Cliente>
  atualizarCliente(id: string, patch: PatchCliente): Promise<Cliente | null>

  criarConversa(input: NovaConversa): Promise<Conversa>
  obterConversa(id: string): Promise<Conversa | null>
  listarConversasDoCliente(clienteId: string): Promise<Conversa[]>

  criarAnalise(input: NovaAnalise): Promise<Analise>
  obterAnalise(id: string): Promise<Analise | null>
  listarAnalisesDoCliente(clienteId: string): Promise<Analise[]>
  listarAnalisesRecentes(corretorId: number, limite: number): Promise<Analise[]>
  contarAnalisesDesde(corretorId: number, desdeIso: string): Promise<number>

  criarLembrete(input: NovoLembrete): Promise<Lembrete>
  listarLembretes(filtro: FiltroLembretes): Promise<Lembrete[]>
  atualizarLembrete(id: string, patch: Partial<Pick<Lembrete, 'status' | 'titulo' | 'data' | 'descricao'>>): Promise<Lembrete | null>

  adicionarImovelInteresse(clienteId: string, codigo: string, origem: 'ia' | 'manual'): Promise<ImovelInteresse>
  listarImoveisInteresse(clienteId: string): Promise<ImovelInteresse[]>

  // configuração chave/valor (ex.: padrão de atendimento editado no painel)
  obterConfig(chave: string): Promise<string | null>
  salvarConfig(chave: string, valor: string, corretor?: CorretorLogado): Promise<void>
}

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// A instância fica em globalThis: cada rota do Next recebe sua própria cópia
// deste módulo, e o adaptador em memória precisa ser único no processo para
// a API e as páginas verem os mesmos dados.
const global = globalThis as typeof globalThis & { __painelDb?: Promise<PainelDb> }

export function getDb(): Promise<PainelDb> {
  if (!global.__painelDb) {
    global.__painelDb = (async () => {
      if (supabaseConfigurado()) {
        const { criarDbSupabase } = await import('./db-supabase')
        return criarDbSupabase()
      }
      const { criarDbMemoria } = await import('./db-memoria')
      return criarDbMemoria()
    })()
  }
  return global.__painelDb
}

// Utilidades compartilhadas pelos adaptadores -------------------------------

export function agoraIso(): string {
  return new Date().toISOString()
}

export function novoId(): string {
  return crypto.randomUUID()
}

export function normalizarTelefone(t: string | null | undefined): string | null {
  if (!t) return null
  const d = t.replace(/\D/g, '')
  if (!d) return null
  // guarda sem DDI 55 para casar variantes do mesmo número
  return d.replace(/^55(?=\d{10,11}$)/, '')
}

export function ordenarClientes(lista: Cliente[]): Cliente[] {
  const peso: Record<Temperatura, number> = { muito_quente: 4, quente: 3, morno: 2, frio: 1 }
  return [...lista].sort((a, b) => {
    const pa = a.temperatura ? peso[a.temperatura] : 0
    const pb = b.temperatura ? peso[b.temperatura] : 0
    if (pb !== pa) return pb - pa
    return (b.ultima_interacao ?? '').localeCompare(a.ultima_interacao ?? '')
  })
}

export type { Temperatura, Estagio, TipoCliente }
