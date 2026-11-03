// Dados de demonstração do painel: usados pelo adaptador em memória (sem
// Supabase) e pela análise em modo demo (sem ANTHROPIC_API_KEY). Todos os
// nomes, telefones e conversas são fictícios.

import type { Analise, AnaliseResultado, Cliente, Conversa, ImovelInteresse, Lembrete } from './tipos'
import type { Property } from '@/lib/jetimob'

export const CORRETOR_DEMO_ID = 77723

const diasAtras = (n: number, hora = 10) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hora, 0, 0, 0)
  return d.toISOString()
}
const diasAFrente = (n: number, hora = 10) => diasAtras(-n, hora)

export const CONVERSA_DEMO = `[24/10/2026 09:12] Mariana Costa: Bom dia Lucas! Vi o anúncio da casa na Gamboa, código C0412. Ainda está disponível?
[24/10/2026 09:20] Lucas: Bom dia, Mariana! Está sim. É a casa de 3 quartos com vista pro mar, a 300 metros da praia. Vocês procuram pra morar ou pra veranear?
[24/10/2026 09:24] Mariana Costa: Pra veranear por enquanto, mas a ideia é morar em uns 2 anos quando meu marido se aposentar. Somos nós dois e os dois filhos, de 12 e 15 anos.
[24/10/2026 09:25] Mariana Costa: Qual o valor mesmo? E aceita financiamento?
[24/10/2026 09:31] Lucas: O valor é R$ 1.390.000. Aceita financiamento sim, e o imóvel tem toda a documentação em dia. Vocês já têm uma ideia de entrada?
[24/10/2026 09:40] Mariana Costa: Temos uns 600 mil da venda do apartamento em Caxias, que já está vendido. O resto seria financiado. Já falamos com o gerente do Banrisul, ele disse que aprova tranquilo.
[24/10/2026 09:41] Mariana Costa: A gente vem pra Garopaba no feriado de 2 de novembro, dá pra visitar?
[24/10/2026 09:45] Lucas: Dá sim! Posso deixar reservado sábado dia 31 às 10h ou domingo dia 1 às 15h. O que fica melhor?
[24/10/2026 09:52] Mariana Costa: Domingo às 15h é melhor, o Ricardo chega sábado à noite. Ele é meio pé no chão com preço, acha que 1,39 tá alto pra região.
[24/10/2026 09:55] Lucas: Combinado, domingo dia 1 às 15h. Vou mandar o comparativo de preços da Gamboa pra vocês verem antes, tudo bem? E tem a casa C0398 também, 3 quartos, um pouco mais afastada, por 1.150.000, se quiserem ver as duas no mesmo dia.
[24/10/2026 10:03] Mariana Costa: Manda sim! Pode agendar as duas. Ah, me liga sexta à tarde pra confirmar? Depois das 14h eu consigo falar.
[24/10/2026 10:04] Lucas: Perfeito, te ligo sexta depois das 14h. Qualquer coisa estou por aqui!
[24/10/2026 10:05] Mariana Costa: Obrigada Lucas! Ah, uma amiga indicou outra imobiliária aqui também, mas a gente gostou mais do seu anúncio.`

export const ANALISE_DEMO: AnaliseResultado = {
  resumo:
    'Mariana Costa, de Caxias do Sul, procura casa de 3 quartos na Gamboa para veranear agora e morar em cerca de 2 anos. Já vendeu o apartamento (R$ 600 mil de entrada) e tem pré-aprovação informal no Banrisul. Visita agendada para domingo, 1 de novembro, às 15h, para as casas C0412 e C0398. O marido Ricardo decide junto e considera o valor de R$ 1,39 milhão alto.',
  temperatura: {
    nivel: 'quente',
    nota: 78,
    justificativa:
      'Recurso de entrada disponível, financiamento encaminhado, visita marcada com data e decisor presente. Não é muito quente porque o decisor financeiro ainda não participou e há objeção de preço explícita, além de concorrente indicado por amiga.',
  },
  estagio: 'visita_agendada',
  fatos: {
    orcamento: 'Cerca de R$ 1,39 milhão (teto citado pelo anúncio); entrada de R$ 600 mil',
    forma_pagamento: 'R$ 600 mil à vista (venda de apartamento já concluída) + financiamento Banrisul (pré-aprovação informal com gerente)',
    prazo: 'Visita em 01/11/2026; compra para veranear agora, mudança definitiva em cerca de 2 anos',
    composicao_familiar: 'Casal (Mariana e Ricardo) com dois filhos, 12 e 15 anos; marido se aposenta em cerca de 2 anos',
    regiao_desejada: 'Praia da Gamboa, Garopaba',
    tipo_imovel: 'Casa, 3 quartos, vista para o mar, próxima à praia',
    imoveis_citados: ['C0412', 'C0398'],
    objecoes: ['Marido (Ricardo) acha R$ 1,39 milhão alto para a região'],
    preferencias: ['Vista para o mar', 'Proximidade da praia (300 m)', 'Documentação em dia', 'Aceitar financiamento'],
    contato: { nome: 'Mariana Costa', telefone: null, email: null },
  },
  insights: [
    { tipo: 'decisor_ausente', descricao: 'Ricardo decide junto e ainda não participou da conversa. Ele chega sábado à noite: vale incluí-lo no envio do comparativo e na confirmação da visita.' },
    { tipo: 'concorrencia', descricao: 'Uma amiga indicou outra imobiliária. A preferência atual é pelo seu anúncio, mas a família vai estar na cidade no feriado e pode visitar com concorrentes.' },
    { tipo: 'urgencia', descricao: 'Dinheiro da venda do apartamento já disponível e viagem marcada para o feriado: janela de decisão curta e concreta.' },
    { tipo: 'oportunidade', descricao: 'A objeção de preço abre espaço para o comparativo de mercado prometido e para apresentar a C0398 como âncora de comparação.' },
  ],
  proxima_mensagem: {
    curta: 'Mariana, bom dia! Segue o comparativo da Gamboa que prometi, com os valores por metro quadrado das últimas vendas na região. Mostra pro Ricardo e domingo às 15h vemos as duas casas com calma, combinado?',
    longa:
      'Mariana, bom dia! Como prometi, segue o comparativo de preços da Gamboa com as últimas vendas de casas de 3 quartos na região, pra vocês terem uma base real antes da visita. A C0412 está dentro da faixa das casas com vista pro mar, e a C0398 serve bem como comparação. Mostra pro Ricardo e, se ele tiver dúvidas sobre valores ou financiamento, me manda que eu respondo direto. Domingo dia 1, às 15h, fico esperando vocês. Até lá!',
  },
  texto_jetimob:
    '24/10/2026, WhatsApp. Perfil: compradora, casa 3 quartos na Gamboa, veranear agora e morar em ~2 anos; casal com 2 filhos (12 e 15); entrada R$ 600 mil (apto em Caxias já vendido) + financiamento Banrisul (pré-aprovação informal); decisor conjunto com marido Ricardo. Imóveis: C0412 (interesse principal) e C0398 (comparação). Objeções: marido acha R$ 1,39 mi alto. Pendências: enviar comparativo de preços da Gamboa; ligar sexta após 14h para confirmar. Próximo passo: visita domingo 01/11 15h às duas casas. Concorrência: amiga indicou outra imobiliária. Temperatura: quente (78).',
  lembretes: [
    { titulo: 'Ligar para Mariana Costa para confirmar a visita', data: '2026-10-30T14:30', trecho: 'me liga sexta à tarde pra confirmar? Depois das 14h eu consigo falar', confianca: 'alta' },
    { titulo: 'Visita com Mariana e Ricardo: casas C0412 e C0398', data: '2026-11-01T15:00', trecho: 'Combinado, domingo dia 1 às 15h', confianca: 'alta' },
    { titulo: 'Enviar comparativo de preços da Gamboa para Mariana', data: '2026-10-24T18:00', trecho: 'Vou mandar o comparativo de preços da Gamboa pra vocês verem antes', confianca: 'media' },
  ],
  perguntas_abertas: [
    'Qual o valor máximo total que a família aceita pagar?',
    'O financiamento já tem carta de crédito formal ou só conversa com o gerente?',
    'Pretendem alugar a casa por temporada quando não estiverem usando?',
    'Precisam de vaga para quantos carros? Pets?',
    'Qual o e-mail e o telefone do Ricardo para incluir no envio?',
  ],
  proximos_passos: [
    'Enviar hoje o comparativo de preços da Gamboa (prometido).',
    'Ligar sexta-feira 30/10 após 14h para confirmar a visita.',
    'Confirmar com os proprietários das casas C0412 e C0398 a disponibilidade para domingo 01/11 às 15h.',
    'Preparar argumentação de valor da C0412 (vista mar, distância da praia, documentação) para a objeção de preço do Ricardo.',
    'Registrar o atendimento no Jetimob com a nota padronizada.',
  ],
  qualidade_atendimento: {
    nota: 74,
    pontos_fortes: [
      'Resposta rápida e tom acolhedor',
      'Perguntou finalidade (morar x veranear) e entrada',
      'Ofereceu duas datas de visita e um segundo imóvel como comparação',
      'Assumiu compromisso claro de retorno (ligação sexta)',
    ],
    faltou_perguntar: [
      'Teto de orçamento total da família',
      'Status formal do financiamento (carta de crédito) e prazo de aprovação',
      'E-mail e telefone para registro no CRM',
      'Intenção de locação por temporada (muda a análise de retorno)',
      'Quem mais participa da decisão além do Ricardo',
    ],
    observacoes:
      'Bom atendimento de primeiro contato. Para subir a temperatura, envolver o Ricardo antes da visita e levar o comparativo impresso.',
  },
}

export const IMOVEIS_DEMO: Property[] = [
  imovel('C0412', 'Casa com vista para o mar na Praia da Gamboa', 'Venda', 'Casa', 3, 1, 2, 2, 1390000, 'Gamboa', 'Garopaba', true),
  imovel('C0398', 'Casa 3 quartos a 600 m da praia, Gamboa', 'Venda', 'Casa', 3, 1, 2, 1, 1150000, 'Gamboa', 'Garopaba', false),
  imovel('T0624', 'Terreno 450 m² no Loteamento Mares de Garopaba', 'Venda', 'Terreno', 0, 0, 0, 0, 320000, 'Ambrósio', 'Garopaba', true),
  imovel('A0231', 'Apartamento 2 quartos com vista, Centro', 'Venda', 'Apartamento', 2, 1, 2, 1, 690000, 'Centro', 'Garopaba', false),
  imovel('C0455', 'Casa de temporada com piscina, Siriú', 'Temporada', 'Casa', 4, 2, 3, 3, null, 'Siriú', 'Garopaba', false, 1200),
  imovel('T0601', 'Terreno plano 360 m², Mares de Garopaba', 'Venda', 'Terreno', 0, 0, 0, 0, 265000, 'Ambrósio', 'Garopaba', true),
  imovel('C0470', 'Casa 2 quartos para locação anual, Ferrugem', 'Locação', 'Casa', 2, 0, 1, 1, null, 'Ferrugem', 'Garopaba', false, null, 3800),
  imovel('C0488', 'Sobrado novo em Paulo Lopes', 'Venda', 'Sobrado', 3, 1, 3, 2, 780000, 'Centro', 'Paulo Lopes', false),
]

function imovel(
  codigo: string,
  titulo: string,
  contrato: string,
  tipo: string,
  dormitorios: number,
  suites: number,
  banheiros: number,
  garagens: number,
  valor_venda: number | null,
  bairro: string,
  cidade: string,
  exclusividade: boolean,
  valor_temporada: number | null = null,
  valor_locacao: number | null = null
): Property {
  return {
    codigo,
    titulo_anuncio: titulo,
    observacoes: 'Imóvel de demonstração do painel. Em produção os dados vêm do Jetimob.',
    contrato,
    tipo,
    subtipo: tipo,
    dormitorios,
    suites,
    banheiros,
    garagens,
    area_total: tipo === 'Terreno' ? 450 : 180,
    area_privativa: tipo === 'Terreno' ? null : 150,
    area_util: tipo === 'Terreno' ? null : 150,
    terreno_total: tipo === 'Terreno' ? '450' : null,
    medida_terreno_total: tipo === 'Terreno' ? 'm²' : null,
    financiavel: 1,
    medida: 'm²',
    valor_venda,
    valor_locacao,
    valor_temporada,
    valor_venda_visivel: true,
    valor_locacao_visivel: true,
    destaque: '',
    latitude: null,
    longitude: null,
    endereco_bairro: bairro,
    endereco_cidade: cidade,
    endereco_estado: 'SC',
    endereco_logradouro: '',
    endereco_cep: '',
    imagens: [],
    status: 'Disponível',
    id_corretor: CORRETOR_DEMO_ID,
    exclusividade,
    data_atualizacao: diasAtras(3),
  }
}

export function dadosDemo() {
  const c = CORRETOR_DEMO_ID
  const clientes: Cliente[] = [
    {
      id: 'demo-cli-mariana',
      corretor_id: c,
      nome: 'Mariana Costa',
      telefone: '54999110001',
      email: 'mariana.demo@example.com',
      tipo: 'comprador',
      origem: 'Anúncio do site',
      temperatura: 'quente',
      nota_temperatura: 78,
      estagio: 'visita_agendada',
      resumo: ANALISE_DEMO.resumo,
      ultima_interacao: diasAtras(5, 10),
      criado_em: diasAtras(5, 9),
      atualizado_em: diasAtras(5, 10),
    },
    {
      id: 'demo-cli-joao',
      corretor_id: c,
      nome: 'João Pedro Almeida',
      telefone: '51999220002',
      email: null,
      tipo: 'comprador',
      origem: 'Instagram',
      temperatura: 'muito_quente',
      nota_temperatura: 90,
      estagio: 'proposta',
      resumo: 'Investidor de Porto Alegre, quer dois lotes no Mares de Garopaba (T0624 e T0601) à vista. Proposta enviada aguardando resposta do loteador.',
      ultima_interacao: diasAtras(1, 16),
      criado_em: diasAtras(20),
      atualizado_em: diasAtras(1, 16),
    },
    {
      id: 'demo-cli-fernanda',
      corretor_id: c,
      nome: 'Fernanda Ribeiro',
      telefone: '48999330003',
      email: 'fernanda.demo@example.com',
      tipo: 'locatario',
      origem: 'Indicação',
      temperatura: 'morno',
      nota_temperatura: 45,
      estagio: 'qualificacao',
      resumo: 'Família de Florianópolis buscando casa de temporada no Siriú para o Réveillon (28/12 a 04/01), 8 pessoas, com piscina. Orçamento até R$ 9 mil no período.',
      ultima_interacao: diasAtras(9, 11),
      criado_em: diasAtras(12),
      atualizado_em: diasAtras(9, 11),
    },
    {
      id: 'demo-cli-carlos',
      corretor_id: c,
      nome: 'Carlos Eduardo Nunes',
      telefone: '48999440004',
      email: null,
      tipo: 'proprietario',
      origem: 'Placa',
      temperatura: 'morno',
      nota_temperatura: 52,
      estagio: 'negociacao',
      resumo: 'Proprietário de casa na Ferrugem (C0470), quer alugar anual por R$ 4.200; mercado indica R$ 3.800. Ainda sem exclusividade assinada.',
      ultima_interacao: diasAtras(3, 15),
      criado_em: diasAtras(30),
      atualizado_em: diasAtras(3, 15),
    },
    {
      id: 'demo-cli-beatriz',
      corretor_id: c,
      nome: 'Beatriz Lima',
      telefone: '11999550005',
      email: null,
      tipo: 'comprador',
      origem: 'Portal',
      temperatura: 'frio',
      nota_temperatura: 18,
      estagio: 'primeiro_contato',
      resumo: 'Perguntou o preço do A0231 e não respondeu mais. Sem prazo nem orçamento informados.',
      ultima_interacao: diasAtras(15, 20),
      criado_em: diasAtras(15),
      atualizado_em: diasAtras(15, 20),
    },
  ]

  const conversas: Conversa[] = [
    {
      id: 'demo-conv-mariana-1',
      cliente_id: 'demo-cli-mariana',
      corretor_id: c,
      texto: CONVERSA_DEMO,
      data_conversa: '2026-10-24T10:05:00.000Z',
      origem: 'whatsapp',
      nome_arquivo: 'Conversa do WhatsApp com Mariana Costa.txt',
      criado_em: diasAtras(5, 10),
    },
  ]

  const analises: Analise[] = [
    {
      id: 'demo-ana-mariana-1',
      conversa_id: 'demo-conv-mariana-1',
      cliente_id: 'demo-cli-mariana',
      corretor_id: c,
      resultado: ANALISE_DEMO,
      modelo: 'demo',
      tokens_entrada: 0,
      tokens_saida: 0,
      custo_usd: 0,
      demo: true,
      criado_em: diasAtras(5, 10),
    },
  ]

  const lembretes: Lembrete[] = [
    {
      id: 'demo-lem-1',
      cliente_id: 'demo-cli-mariana',
      corretor_id: c,
      titulo: 'Ligar para Mariana Costa para confirmar a visita',
      descricao: 'Trecho: "me liga sexta à tarde pra confirmar? Depois das 14h eu consigo falar"',
      data: diasAFrente(1, 14),
      status: 'pendente',
      origem: 'ia',
      analise_id: 'demo-ana-mariana-1',
      criado_em: diasAtras(5, 10),
      atualizado_em: diasAtras(5, 10),
    },
    {
      id: 'demo-lem-2',
      cliente_id: 'demo-cli-mariana',
      corretor_id: c,
      titulo: 'Visita com Mariana e Ricardo: casas C0412 e C0398',
      descricao: null,
      data: diasAFrente(3, 15),
      status: 'pendente',
      origem: 'ia',
      analise_id: 'demo-ana-mariana-1',
      criado_em: diasAtras(5, 10),
      atualizado_em: diasAtras(5, 10),
    },
    {
      id: 'demo-lem-3',
      cliente_id: 'demo-cli-joao',
      corretor_id: c,
      titulo: 'Cobrar resposta do loteador sobre a proposta do João Pedro',
      descricao: null,
      data: diasAtras(1, 9),
      status: 'pendente',
      origem: 'manual',
      analise_id: null,
      criado_em: diasAtras(2),
      atualizado_em: diasAtras(2),
    },
    {
      id: 'demo-lem-4',
      cliente_id: 'demo-cli-fernanda',
      corretor_id: c,
      titulo: 'Enviar opções de casa com piscina no Siriú para Fernanda',
      descricao: null,
      data: diasAtras(0, 18),
      status: 'pendente',
      origem: 'manual',
      analise_id: null,
      criado_em: diasAtras(9),
      atualizado_em: diasAtras(9),
    },
    {
      id: 'demo-lem-5',
      cliente_id: 'demo-cli-carlos',
      corretor_id: c,
      titulo: 'Levar autorização de locação para o Carlos assinar',
      descricao: null,
      data: diasAtras(4, 10),
      status: 'concluido',
      origem: 'manual',
      analise_id: null,
      criado_em: diasAtras(6),
      atualizado_em: diasAtras(4),
    },
  ]

  const imoveis_interesse: ImovelInteresse[] = [
    { id: 'demo-int-1', cliente_id: 'demo-cli-mariana', codigo_imovel: 'C0412', origem: 'ia', criado_em: diasAtras(5) },
    { id: 'demo-int-2', cliente_id: 'demo-cli-mariana', codigo_imovel: 'C0398', origem: 'ia', criado_em: diasAtras(5) },
    { id: 'demo-int-3', cliente_id: 'demo-cli-joao', codigo_imovel: 'T0624', origem: 'manual', criado_em: diasAtras(10) },
    { id: 'demo-int-4', cliente_id: 'demo-cli-joao', codigo_imovel: 'T0601', origem: 'manual', criado_em: diasAtras(10) },
    { id: 'demo-int-5', cliente_id: 'demo-cli-beatriz', codigo_imovel: 'A0231', origem: 'manual', criado_em: diasAtras(15) },
    { id: 'demo-int-6', cliente_id: 'demo-cli-carlos', codigo_imovel: 'C0470', origem: 'manual', criado_em: diasAtras(30) },
  ]

  return { clientes, conversas, analises, lembretes, imoveis_interesse, config: {} as Record<string, string> }
}
