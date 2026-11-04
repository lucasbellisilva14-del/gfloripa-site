-- Ponte do WhatsApp (somente leitura) para o Painel do Corretor.
--
-- O serviço em servicos/whatsapp mantém a conexão e repassa as mensagens ao
-- painel por HTTP; só o painel fala com o Postgres. Nenhuma mensagem é
-- enviada pela ponte: o corretor responde pelo WhatsApp normal.
--
-- Aplicar igual à migration anterior: SQL Editor do Supabase > Run.

-- Estado da conexão (uma linha por corretor) -------------------------------
create table if not exists public.whatsapp_estado (
  corretor_id integer primary key,
  status text not null default 'desconectado'
    check (status in ('desconectado', 'aguardando_qr', 'conectando', 'conectado')),
  qr text,                                   -- QR em data URL, válido por ~60s
  numero text,                               -- número conectado, só dígitos
  detalhe text,                              -- última mensagem de erro ou aviso
  atualizado_em timestamptz not null default now()
);

-- Sessão do Baileys em uma única linha (credenciais + chaves de sinal).
-- Guardada aqui para o serviço reiniciar sem precisar parear de novo.
create table if not exists public.whatsapp_sessao (
  corretor_id integer primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Conversas do WhatsApp ----------------------------------------------------
create table if not exists public.whatsapp_chats (
  id uuid primary key default gen_random_uuid(),
  corretor_id integer not null,
  wa_chat_id text not null,                  -- ex.: 5548999990000@s.whatsapp.net
  nome text,                                 -- nome na agenda ou pushName
  telefone text,                             -- só dígitos, sem DDI
  cliente_id uuid references public.clientes (id) on delete set null,
  total_mensagens integer not null default 0,
  ultima_mensagem_em timestamptz,
  ultimo_texto text,                         -- prévia da última mensagem
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (corretor_id, wa_chat_id)
);
create index if not exists whatsapp_chats_corretor_idx
  on public.whatsapp_chats (corretor_id, arquivado, ultima_mensagem_em desc);

-- Mensagens ----------------------------------------------------------------
create table if not exists public.whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.whatsapp_chats (id) on delete cascade,
  corretor_id integer not null,
  wa_id text not null,                       -- id da mensagem no WhatsApp
  direcao text not null check (direcao in ('entrada', 'saida')),
  autor text,                                -- quem escreveu, para a transcrição
  texto text not null,
  data timestamptz not null,
  criado_em timestamptz not null default now(),
  unique (chat_id, wa_id)
);
create index if not exists whatsapp_mensagens_chat_idx
  on public.whatsapp_mensagens (chat_id, data);

-- RLS ligado e sem políticas: acesso só pela service role, no servidor.
alter table public.whatsapp_estado enable row level security;
alter table public.whatsapp_sessao enable row level security;
alter table public.whatsapp_chats enable row level security;
alter table public.whatsapp_mensagens enable row level security;

comment on table public.whatsapp_sessao is 'Credenciais da sessão do WhatsApp: tratar como segredo';
comment on table public.whatsapp_mensagens is 'Conversas de clientes (dados pessoais, LGPD)';
