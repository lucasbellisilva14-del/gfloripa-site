# Painel do Corretor com I.A. (fase 1)

Área interna do site da Nagamboa Imóveis em `/painel`: o corretor cola ou
envia uma conversa com o cliente e a I.A. (Claude) devolve temperatura do
lead, fatos, insights, próxima mensagem, nota pronta para o Jetimob e
lembretes detectados. Tudo fica salvo por cliente para acompanhamento da
carteira.

Funciona em três situações, sem quebrar o site público em nenhuma delas:

| Situação | O que acontece |
| --- | --- |
| Sem nenhuma variável nova (dev ou nuvem) | Modo demonstração: login com senha `demo`, dados de exemplo em memória, análise devolve um resultado fixo. |
| Com `ANTHROPIC_API_KEY` | A análise é real, feita pelo modelo configurado. |
| Com Supabase configurado | Clientes, conversas, análises e lembretes vão para o Postgres. |

## Telas

| Rota | O que mostra | Captura |
| --- | --- | --- |
| `/painel/login` | Senha única, cookie de sessão assinado (14 dias). | `capturas/01-login.png` |
| `/painel` | Dashboard: leads por temperatura, lembretes de hoje e atrasados, análises na semana, clientes ordenados por temperatura, últimas análises. | `capturas/02-dashboard.png`, `08-dashboard-escuro.png` |
| `/painel/analisar` | Formulário (texto ou arquivo .txt/.md/.pdf, nome, telefone, código do imóvel, tipo, data da conversa) e resultado em cards com botão copiar e "criar lembrete". | `capturas/03-analise.png` |
| `/painel/clientes` e `/painel/clientes/[id]` | Lista da carteira; página do cliente com fatos consolidados, evolução da temperatura, imóveis de interesse (dados do Jetimob quando há chave), lembretes e linha do tempo. | `capturas/04-cliente.png` |
| `/painel/analises/[id]` | Uma análise salva, com a conversa original. | |
| `/painel/lembretes` | Atrasados, hoje, próximos, concluídos; criação manual. | `capturas/05-lembretes.png` |
| `/painel/imoveis` | Imóveis do corretor logado (`getAllProperties` filtrado por `id_corretor`) com busca. | `capturas/06-imoveis.png` |
| `/painel/configuracoes` | Estado das integrações e editor do padrão de atendimento. | `capturas/07-configuracoes.png` |

Mobile: barra superior com menu; tabelas viram cartões abaixo de 860px
(`capturas/09-mobile.png`). Tema claro, escuro ou automático.

## Arquitetura

```
src/proxy.ts                         protege /painel/* e /api/painel/* (cookie assinado)
src/app/(painel)/painel/
  layout.tsx, painel.css             CSS isolado pelo prefixo .painel-shell, robots noindex
  login/page.tsx
  (app)/layout.tsx                   shell autenticado (sidebar/topbar)
  (app)/page.tsx                     dashboard
  (app)/analisar, clientes, analises, lembretes, imoveis, configuracoes
src/app/api/painel/
  login, logout                      sessão
  analisar                           POST multipart: texto ou arquivo + metadados
  lembretes, lembretes/[id]          criar e mudar status
  clientes                           listar / cadastro manual
  padrao                             ler / salvar o padrão de atendimento
  jetimob/enviar                     envio ao Jetimob (atrás de flag)
src/lib/painel/
  auth.ts, sessao.ts                 senha, HMAC (Web Crypto), corretor logado
  db.ts                              interface PainelDb + fábrica (Supabase ou memória)
  db-supabase.ts                     PostgREST via fetch (service role, só no servidor)
  db-memoria.ts                      memória + JSON local (.painel-dados/, ignorado pelo git)
  analise.ts                         chamada à API da Anthropic, custo, modo demo
  analise-schema.ts                  JSON Schema da análise + validador/normalizador
  padrao-atendimento.ts              lê o .md ou a versão editada no banco
  extrair-texto.ts                   .txt / .md / .pdf simples, detecção de data
  imoveis.ts                         imóveis do corretor (Jetimob ou demo)
  jetimob-escrita.ts                 camada de escrita no Jetimob (ver jetimob-api.md)
  demo.ts, formato.ts, tipos.ts
src/painel/padrao-atendimento.md     treinamento da I.A. (v0, pontos REVISAR)
src/components/painel/*              componentes de interface
supabase/migrations/*.sql            tabelas
tests/painel/*.test.mjs              testes (node:test) do validador
scripts/qa-painel.mjs                QA de ponta a ponta com Playwright (modo demo)
```

Decisões:

- **Sem dependências novas**: Anthropic e Supabase são chamados com `fetch`,
  seguindo o padrão do site (`src/app/api/chat/route.ts`) e a regra do
  projeto. Se o painel crescer, vale avaliar `@anthropic-ai/sdk` e
  `@supabase/supabase-js`.
- **Saída estruturada**: a análise usa `output_config.format` (JSON Schema)
  da API da Anthropic, com `anthropic-version: 2026-10-21`; o resultado
  ainda passa por `validarAnalise()` (limites de nota, datas, coerência
  nível x nota). O padrão de atendimento vai no `system` com
  `cache_control` para baratear chamadas repetidas.
- **Corretor logado**: o cookie carrega `{ id, nome, email }`, onde `id` é o
  id do corretor no Jetimob (Lucas = 77723). Todas as tabelas têm
  `corretor_id`, então multiusuário é trocar o login por uma tabela de
  corretores (fase 2) sem migrar dados.
- **Banco em memória** vive em `globalThis` para API e páginas compartilharem
  o mesmo estado no mesmo processo. Na Vercel o disco é somente leitura e
  cada instância é isolada: em produção use o Supabase.
- **O site público não muda**: só o `ChatWidget` ganhou um `return null`
  quando a rota começa com `/painel`.

## Variáveis de ambiente

Adicionar em `.env.local` (nunca commitar) e em Vercel > Settings >
Environment Variables (variável nova exige Redeploy).

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `PAINEL_SENHA` | sim em produção | Senha única do painel. Sem ela, em produção o login fica desabilitado; em dev (ou com `PAINEL_DEMO=1`) a senha `demo` entra. |
| `PAINEL_SESSION_SECRET` | sim em produção | Segredo do HMAC do cookie. Gere com `openssl rand -hex 32`. |
| `PAINEL_CORRETOR_ID` | não (padrão 77723) | Id do corretor logado no Jetimob. |
| `PAINEL_CORRETOR_NOME` | não (padrão Lucas) | Nome exibido no painel. |
| `PAINEL_CORRETOR_EMAIL` | não | E-mail do corretor no Jetimob (usado como `responsible` no envio de leads). |
| `SUPABASE_URL` | não | URL do projeto Supabase (`https://xxxx.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | não | Service role key (só servidor). Sem as duas, modo memória. |
| `ANTHROPIC_API_KEY` | não | Já existe para a Lia. Sem ela a análise devolve o exemplo fixo. |
| `PAINEL_ANTHROPIC_MODEL` | não (padrão `claude-sonnet-5-5`) | Modelo da análise. Alternativas: `claude-opus-5-5` (mais caro e preciso), `claude-haiku-5-5` (barato). |
| `PAINEL_ANTHROPIC_EFFORT` | não (padrão `medium`) | Esforço de raciocínio: `low`, `medium`, `high`. |
| `PAINEL_DEMO` | não | `1` libera a senha `demo` mesmo em produção (só para preview). |
| `PAINEL_JETIMOB_ENVIO` | não | `1` ativa o botão "Enviar para o Jetimob" (usa `JETIMOB_PUBLIC_KEY`/`JETIMOB_PRIVATE_KEY`). |

Custo estimado por análise com Sonnet 5.5: uma conversa de WhatsApp típica
(3 a 6 mil tokens de entrada com o padrão de atendimento, 2 a 3 mil de saída)
fica entre US$ 0,03 e US$ 0,05. O valor exato é gravado em cada análise.

## Rodar local

```bash
npm install
cp docs/painel/env.exemplo .env.local   # e preencha o que tiver
npm run dev
```

Abra http://localhost:3000/painel/login. Sem `PAINEL_SENHA`, entre com `demo`.

Verificações:

```bash
npm run lint
npm run build
npm test                 # validador da análise (node:test)
node scripts/qa-painel.mjs   # com o servidor no ar; em modo demo (PAINEL_DEMO=1 se for next start)
```

## Aplicar as migrations no Supabase

1. Crie um projeto em https://supabase.com (ou use o existente).
2. SQL Editor > New query > cole `supabase/migrations/20261029120000_painel_inicial.sql` > Run.
   Com a CLI: `supabase link --project-ref <ref>` e `supabase db push`.
3. Settings > API: copie a URL do projeto e a service role key para
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
4. Redeploy na Vercel. Em `/painel/configuracoes` a linha "Banco" deve
   aparecer como ativa.

As tabelas ficam com RLS ligado e sem políticas: só a service role key (no
servidor, atrás do login) enxerga os dados.

## Dados pessoais (LGPD)

Clientes, telefones, e-mails e conversas são dados pessoais. No painel:

- Só são acessíveis após login (proxy + checagem nas rotas e no layout).
- Ficam no Supabase do dono (ou em memória em demo), nunca em cache público.
- O texto da conversa é enviado à API da Anthropic só para a análise; a
  chave fica no servidor. Vale citar a finalidade na política de privacidade
  (pendência já conhecida do site).
- Rotas do painel têm `robots: noindex`.

## Padrão de atendimento

`src/painel/padrao-atendimento.md` é a v0, escrita para imobiliária de praia
(venda e temporada em Garopaba). Pontos marcados **REVISAR**: horários e
janela de resposta, uso de emoji, política de reserva e comissões, prazos de
follow-up e reaproximação, faixas de temperatura, empreendimentos
prioritários. A edição em `/painel/configuracoes` grava no banco e passa a
valer na hora; a versão definitiva deve voltar para o arquivo (versionado).

## Roadmap da fase 2

- **Automações de lembrete**: aviso por WhatsApp (API oficial) ou e-mail no
  dia, e resumo das tarefas pela manhã (Vercel Cron + tabela `lembretes`).
- **Importação em lote**: enviar um .zip de exportações do WhatsApp; fila
  de análises com Batches da Anthropic (50% mais barato).
- **Relatório semanal da carteira**: clientes que esfriaram, promessas não
  cumpridas, previsão de fechamento; gerado pela I.A. a partir das análises.
- **Integração WhatsApp Business API**: captura automática das conversas,
  sem copiar e colar.
- **Jetimob**: quando a Jetimob liberar o MCP ou endpoints de escrita, ligar
  `jetimob-escrita.ts` para anotar histórico, criar tarefa e atualizar o
  funil direto no CRM (hoje só criação de lead, atrás de flag).
- **Multiusuário**: tabela `corretores` (nome, e-mail, id Jetimob, senha
  hash), login por usuário, filtro por `corretor_id` já existente.
- **Painel do gestor**: visão de todos os corretores, qualidade média do
  atendimento, funil consolidado.
- **Produto (ONOS)**: tenant por imobiliária, padrão de atendimento por
  tenant, cobrança por análise.
