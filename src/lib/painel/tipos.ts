// Tipos de domínio do Painel do Corretor. Compartilhados entre a camada de
// dados (src/lib/painel/db.ts), as rotas /api/painel/* e as telas.

export type TipoCliente = 'comprador' | 'locatario' | 'proprietario' | 'indefinido'

export type Temperatura = 'frio' | 'morno' | 'quente' | 'muito_quente'

export type Estagio =
  | 'primeiro_contato'
  | 'qualificacao'
  | 'visita_agendada'
  | 'visita_feita'
  | 'proposta'
  | 'negociacao'
  | 'fechamento'
  | 'perdido'

export const TEMPERATURAS: Temperatura[] = ['frio', 'morno', 'quente', 'muito_quente']
export const ESTAGIOS: Estagio[] = [
  'primeiro_contato',
  'qualificacao',
  'visita_agendada',
  'visita_feita',
  'proposta',
  'negociacao',
  'fechamento',
  'perdido',
]

export const ROTULO_TEMPERATURA: Record<Temperatura, string> = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
  muito_quente: 'Muito quente',
}

export const ROTULO_ESTAGIO: Record<Estagio, string> = {
  primeiro_contato: 'Primeiro contato',
  qualificacao: 'Qualificação',
  visita_agendada: 'Visita agendada',
  visita_feita: 'Visita feita',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechamento: 'Fechamento',
  perdido: 'Perdido',
}

export const ROTULO_TIPO_CLIENTE: Record<TipoCliente, string> = {
  comprador: 'Comprador',
  locatario: 'Locatário',
  proprietario: 'Proprietário',
  indefinido: 'Não informado',
}

// Corretor autenticado no painel. Hoje há um único corretor (senha única),
// mas o modelo já separa identidade do site (nome) do id no CRM Jetimob
// para evoluir para multiusuário sem mexer nas tabelas.
export type CorretorLogado = {
  id: number // id do corretor no Jetimob (ex.: Lucas = 77723)
  nome: string
  email?: string | null
}

export type Cliente = {
  id: string
  corretor_id: number
  nome: string
  telefone: string | null
  email: string | null
  tipo: TipoCliente
  // 'manual' = fixado pelo corretor na ficha ou no formulário; a I.A. não mexe
  tipo_origem: 'ia' | 'manual'
  origem: string | null
  temperatura: Temperatura | null
  nota_temperatura: number | null
  estagio: Estagio | null
  resumo: string | null // fatos consolidados pela última análise
  ultima_interacao: string | null // ISO
  criado_em: string
  atualizado_em: string
}

export type Conversa = {
  id: string
  cliente_id: string
  corretor_id: number
  texto: string
  data_conversa: string // ISO (data em que a conversa aconteceu)
  origem: string // 'whatsapp' | 'colado' | 'arquivo' | ...
  nome_arquivo: string | null
  criado_em: string
}

export type Analise = {
  id: string
  conversa_id: string
  cliente_id: string
  corretor_id: number
  resultado: AnaliseResultado
  modelo: string
  tokens_entrada: number
  tokens_saida: number
  custo_usd: number
  demo: boolean
  criado_em: string
}

export type StatusLembrete = 'pendente' | 'concluido' | 'cancelado'

export type Lembrete = {
  id: string
  cliente_id: string | null
  corretor_id: number
  titulo: string
  descricao: string | null
  data: string // ISO
  status: StatusLembrete
  origem: 'ia' | 'manual'
  analise_id: string | null
  criado_em: string
  atualizado_em: string
}

export type ImovelInteresse = {
  id: string
  cliente_id: string
  codigo_imovel: string
  origem: 'ia' | 'manual'
  criado_em: string
}

// ---------------------------------------------------------------------------
// Resultado estruturado devolvido pela I.A. (ver analise-schema.ts)
// ---------------------------------------------------------------------------

export type TipoInsight =
  | 'urgencia'
  | 'hesitacao'
  | 'concorrencia'
  | 'decisor_ausente'
  | 'risco_perda'
  | 'oportunidade'
  | 'outro'

export type Confianca = 'alta' | 'media' | 'baixa'

export type AnaliseResultado = {
  // transcrição do diálogo quando a conversa chegou como print; null quando
  // a entrada já era texto
  transcricao: string | null
  resumo: string
  // papel do cliente deduzido pela I.A. com o histórico em conta
  tipo_cliente: TipoCliente
  temperatura: {
    nivel: Temperatura
    nota: number // 0 a 100
    justificativa: string
  }
  estagio: Estagio
  fatos: {
    orcamento: string | null
    forma_pagamento: string | null
    prazo: string | null
    composicao_familiar: string | null
    regiao_desejada: string | null
    tipo_imovel: string | null
    imoveis_citados: string[]
    objecoes: string[]
    preferencias: string[]
    contato: {
      nome: string | null
      telefone: string | null
      email: string | null
    }
  }
  insights: { tipo: TipoInsight; descricao: string }[]
  proxima_mensagem: { curta: string; longa: string }
  texto_jetimob: string
  lembretes: {
    titulo: string
    data: string // ISO 8601 (data ou data e hora) já convertida para absoluta
    trecho: string
    confianca: Confianca
  }[]
  perguntas_abertas: string[]
  proximos_passos: string[]
  qualidade_atendimento: {
    nota: number // 0 a 100
    pontos_fortes: string[]
    faltou_perguntar: string[]
    observacoes: string
  }
}

// ---------------------------------------------------------------------------
// Ponte do WhatsApp (somente leitura)
// ---------------------------------------------------------------------------

export type StatusWhatsapp = 'desconectado' | 'aguardando_qr' | 'conectando' | 'conectado'

export const ROTULO_STATUS_WHATSAPP: Record<StatusWhatsapp, string> = {
  desconectado: 'Desconectado',
  aguardando_qr: 'Aguardando leitura do código',
  conectando: 'Conectando',
  conectado: 'Conectado',
}

// Comandos que a tela pode pedir ao serviço. O serviço consome e limpa.
export type ComandoWhatsapp = 'reconectar' | 'parear_novamente' | 'pulso'
export const COMANDOS_WHATSAPP: ComandoWhatsapp[] = ['reconectar', 'parear_novamente', 'pulso']

// O que o serviço informa a cada sinal de vida. Serve para a tela dizer se
// ele está vendo mensagens, se consegue entregá-las e qual versão está rodando.
export type DiagnosticoWhatsapp = {
  versao: string | null // commit em execução na hospedagem
  desde: string | null // quando o processo subiu
  vistas: number // mensagens que a biblioteca entregou ao serviço
  aceitas: number // passaram nos filtros (pessoa, texto, janela)
  enviadas: number // entregues ao painel com sucesso
  falhas_envio: number
  ultima_vista_em: string | null
  ultimo_erro: string | null
  painel_url: string | null
}

export type EstadoWhatsapp = {
  corretor_id: number
  status: StatusWhatsapp
  qr: string | null
  numero: string | null
  detalhe: string | null
  comando: ComandoWhatsapp | null
  comando_em: string | null
  diagnostico: DiagnosticoWhatsapp | null
  atualizado_em: string
}

export type ChatWhatsapp = {
  id: string
  corretor_id: number
  wa_chat_id: string
  nome: string | null
  telefone: string | null
  cliente_id: string | null
  total_mensagens: number
  ultima_mensagem_em: string | null
  ultimo_texto: string | null
  arquivado: boolean
  analisado_em: string | null
  mensagens_analisadas: number
  criado_em: string
}

export type MensagemWhatsapp = {
  id: string
  chat_id: string
  corretor_id: number
  wa_id: string
  direcao: 'entrada' | 'saida'
  autor: string | null
  texto: string
  data: string
  criado_em: string
}

// Mensagem como a ponte envia ao painel.
export type MensagemRecebida = {
  wa_chat_id: string
  wa_id: string
  direcao: 'entrada' | 'saida'
  nome: string | null
  autor: string | null
  texto: string
  data: string
}
