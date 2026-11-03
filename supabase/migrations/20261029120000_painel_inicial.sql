-- Painel do Corretor com I.A. (fase 1): tabelas de clientes, conversas,
-- análises, lembretes, imóveis de interesse e configuração.
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar, ou
-- `supabase db push` com a CLI. Idempotente (IF NOT EXISTS).
--
-- Acesso: o painel usa a service role key no servidor (atrás do login).
-- RLS fica habilitado sem políticas para a anon key não enxergar nada.

create extension if not exists pgcrypto;

-- Clientes / leads ---------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  corretor_id integer not null,                       -- id do corretor no Jetimob (Lucas = 77723)
  nome text not null,
  telefone text,
  telefone_normalizado text,                          -- só dígitos, sem DDI, para casar variantes
  email text,
  tipo text not null default 'indefinido'
    check (tipo in ('comprador', 'locatario', 'proprietario', 'indefinido')),
  origem text,
  temperatura text
    check (temperatura is null or temperatura in ('frio', 'morno', 'quente', 'muito_quente')),
  nota_temperatura integer check (nota_temperatura is null or (nota_temperatura between 0 and 100)),
  estagio text
    check (estagio is null or estagio in ('primeiro_contato', 'qualificacao', 'visita_agendada', 'visita_feita', 'proposta', 'negociacao', 'fechamento', 'perdido')),
  resumo text,
  ultima_interacao timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists clientes_corretor_idx on public.clientes (corretor_id, atualizado_em desc);
create index if not exists clientes_telefone_idx on public.clientes (corretor_id, telefone_normalizado);

-- Conversas (texto bruto) -----------------------------------------------------
create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  corretor_id integer not null,
  texto text not null,
  data_conversa timestamptz not null,
  origem text not null default 'colado',              -- whatsapp | colado | arquivo | ...
  nome_arquivo text,
  criado_em timestamptz not null default now()
);
create index if not exists conversas_cliente_idx on public.conversas (cliente_id, data_conversa desc);

-- Análises da I.A. ------------------------------------------------------------
create table if not exists public.analises (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  corretor_id integer not null,
  resultado jsonb not null,                           -- ver src/lib/painel/analise-schema.ts
  modelo text not null,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric(10, 6) not null default 0,
  demo boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists analises_cliente_idx on public.analises (cliente_id, criado_em desc);
create index if not exists analises_corretor_idx on public.analises (corretor_id, criado_em desc);

-- Lembretes -----------------------------------------------------------------
create table if not exists public.lembretes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete set null,
  corretor_id integer not null,
  titulo text not null,
  descricao text,
  data text not null,                                 -- ISO 8601 sem fuso (hora local SC), como a I.A. devolve
  status text not null default 'pendente' check (status in ('pendente', 'concluido', 'cancelado')),
  origem text not null default 'manual' check (origem in ('ia', 'manual')),
  analise_id uuid references public.analises (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists lembretes_corretor_idx on public.lembretes (corretor_id, status, data);

-- Imóveis de interesse (cliente x código do imóvel no Jetimob) ---------------
create table if not exists public.imoveis_interesse (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  codigo_imovel text not null,
  origem text not null default 'manual' check (origem in ('ia', 'manual')),
  criado_em timestamptz not null default now(),
  unique (cliente_id, codigo_imovel)
);

-- Configuração chave/valor (ex.: padrão de atendimento editado no painel) -----
create table if not exists public.painel_config (
  chave text primary key,
  valor text not null,
  atualizado_por integer,
  atualizado_em timestamptz not null default now()
);

-- RLS: nenhuma política = acesso só com a service role key (servidor).
alter table public.clientes enable row level security;
alter table public.conversas enable row level security;
alter table public.analises enable row level security;
alter table public.lembretes enable row level security;
alter table public.imoveis_interesse enable row level security;
alter table public.painel_config enable row level security;

comment on table public.clientes is 'Painel do Corretor: leads/clientes (dados pessoais, LGPD)';
comment on table public.conversas is 'Painel do Corretor: texto bruto das conversas analisadas';
comment on table public.analises is 'Painel do Corretor: resultado estruturado da I.A. por conversa';
comment on table public.lembretes is 'Painel do Corretor: tarefas detectadas pela I.A. ou manuais';
