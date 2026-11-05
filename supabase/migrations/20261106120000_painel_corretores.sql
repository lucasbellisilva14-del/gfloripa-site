-- Login individual por corretor. O id continua sendo o mesmo usado em
-- corretor_id nas outras tabelas (Lucas = 77723, id do Jetimob); os demais
-- recebem ids internos fixos e podem ser ligados ao Jetimob depois, pela
-- coluna jetimob_id (Configurações > Equipe).
--
-- Senhas ficam só como hash (PBKDF2). Sem senha definida, o corretor não
-- entra até o gestor criar uma em Configurações > Equipe. O gestor padrão
-- continua entrando com PAINEL_SENHA.
--
-- Aplicar igual às anteriores: SQL Editor do Supabase > Run. Idempotente.

create table if not exists public.corretores (
  id integer primary key,
  usuario text not null unique,
  nome text not null,
  email text,
  papel text not null default 'corretor' check (papel in ('gestor', 'corretor')),
  senha_hash text,
  jetimob_id integer,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.corretores enable row level security;

insert into public.corretores (id, usuario, nome, papel, jetimob_id) values
  (77723, 'lucas', 'Lucas', 'gestor', 77723),
  (1001, 'murilo', 'Murilo', 'corretor', null),
  (1002, 'edmilson', 'Edmilson', 'corretor', null),
  (1003, 'marcia', 'Marcia', 'corretor', null),
  (1004, 'juliana', 'Juliana', 'corretor', null)
on conflict (id) do nothing;
