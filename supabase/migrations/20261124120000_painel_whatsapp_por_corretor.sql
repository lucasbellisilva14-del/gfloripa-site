-- Um WhatsApp por corretor. Cada corretor ganha o próprio token da ponte
-- (gerado pelo gestor em Configurações > Equipe) e, opcionalmente, o endereço
-- público do serviço dele na hospedagem, para a tela agir na hora.
--
-- O token da variável PAINEL_WHATSAPP_TOKEN continua valendo para o gestor
-- padrão, então nada muda para quem já está conectado.
--
-- Aplicar igual às anteriores: SQL Editor do Supabase > Run. Idempotente.

alter table public.corretores
  add column if not exists whatsapp_token text unique,
  add column if not exists whatsapp_ponte_url text;
