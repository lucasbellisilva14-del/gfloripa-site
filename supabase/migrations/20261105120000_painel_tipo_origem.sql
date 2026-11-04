-- Origem do tipo do cliente: 'ia' (deduzido pela análise) ou 'manual' (fixado
-- pelo corretor na ficha). O que for manual a análise nunca sobrescreve.
--
-- Aplicar igual às anteriores: SQL Editor do Supabase > Run. Idempotente.

alter table public.clientes
  add column if not exists tipo_origem text not null default 'ia'
    check (tipo_origem in ('ia', 'manual'));
