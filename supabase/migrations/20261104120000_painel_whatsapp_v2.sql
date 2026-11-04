-- Ponte do WhatsApp, segunda rodada: canal de comando do painel para o
-- serviço, diagnóstico no sinal de vida e controle de "novas desde a última
-- análise" por conversa.
--
-- Aplicar igual às anteriores: SQL Editor do Supabase > Run. Idempotente.

-- Comando pendente para o serviço executar (reconectar, parear_novamente,
-- pulso). O serviço consome e limpa. Diagnóstico é o que o serviço informa a
-- cada sinal de vida: contadores, versão em execução, último erro.
alter table public.whatsapp_estado
  add column if not exists comando text,
  add column if not exists comando_em timestamptz,
  add column if not exists diagnostico jsonb;

-- Quando a conversa foi analisada pela última vez e quantas mensagens havia:
-- a diferença para o total atual é o que a tela mostra como "novas".
alter table public.whatsapp_chats
  add column if not exists analisado_em timestamptz,
  add column if not exists mensagens_analisadas integer not null default 0;
