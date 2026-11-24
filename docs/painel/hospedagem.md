# Hospedagem: site na Vercel, painel e pontes no Railway

O site público e o painel saem do mesmo repositório, mas rodam em lugares
diferentes desde novembro de 2026, quando o painel estourou a cota de
transferência da conta Hobby da Vercel e pausou o site junto.

```
www.nagamboaimoveis.com.br     Vercel (Hobby, gratuito)   só o site público
painel.nagamboaimoveis.com.br  Railway                    o painel (/painel e /api/painel)
ponte-<corretor>               Railway                    uma ponte do WhatsApp por corretor
```

Como funciona no código: a variável `PAINEL_HOST` (o host do painel) faz o
proxy redirecionar. No site, qualquer `/painel` ou `/api/painel` vai para o
host do painel; no host do painel, a raiz `/` leva ao `/painel`. Sem a
variável, nada muda, e é assim que o ambiente local roda.

## Subir o painel no Railway

1. No projeto do Railway (o mesmo das pontes): **New**, **GitHub Repo**,
   escolha `gfloripa-site`. Root Directory fica em branco (raiz do
   repositório). O arquivo `railway.json` da raiz já define build, start e
   a verificação de saúde em `/painel/login`.
2. **Variables**: copie da Vercel todas as variáveis do painel e das
   integrações:
   `PAINEL_SENHA`, `PAINEL_SESSION_SECRET`, `PAINEL_WHATSAPP_TOKEN`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
   `PAINEL_ANTHROPIC_MODEL`, `JETIMOB_API_URL`, `JETIMOB_API_KEY`,
   `JETIMOB_PUBLIC_KEY`, `JETIMOB_PRIVATE_KEY`, `JETIMOB_LEAD_ORIGEM_ID`,
   `WHATSAPP_PONTE_URL`, `WHATSAPP_HOSPEDAGEM_URL`. Acrescente
   `PAINEL_HOST=painel.nagamboaimoveis.com.br`.
3. **Settings, Networking, Custom Domain**: `painel.nagamboaimoveis.com.br`.
   O Railway mostra o registro CNAME para criar no DNS do domínio (onde o
   domínio é administrado, normalmente o registrador). Crie e espere
   propagar (minutos a algumas horas).
4. Abra `https://painel.nagamboaimoveis.com.br/painel/login` e entre. Teste
   uma análise e a tela do WhatsApp.
5. **Pontes**: em cada serviço de ponte, troque `PAINEL_URL` para
   `https://painel.nagamboaimoveis.com.br` e faça Redeploy. A sessão fica no
   volume, então não pede QR de novo.
6. **Vercel**: acrescente `PAINEL_HOST=painel.nagamboaimoveis.com.br` nas
   variáveis do projeto e faça Redeploy. A partir daí o site redireciona o
   painel para o Railway. As variáveis do painel podem ser removidas da
   Vercel depois (só `PAINEL_HOST` precisa ficar).
7. **Limite de gasto**: no Railway, Account Settings, Usage, defina um
   limite com alerta por e-mail. Esperado: US$ 10 a 20 por mês com o painel
   e cinco pontes.

Ordem que evita ficar fora do ar: passos 1 a 4 não afetam ninguém; 5 muda as
pontes uma a uma; 6 é a troca final, e desfazer é remover a variável.

## Reverter

Remova `PAINEL_HOST` da Vercel e faça Redeploy: o painel volta a responder
no site. Troque `PAINEL_URL` das pontes de volta. O banco (Supabase) é o
mesmo nos dois lugares, então nada se perde.

## O que muda em relação à Vercel

- Sem limite de 4,5 MB no corpo das requisições nem de 60 segundos por
  função: a análise com arquivos e o relatório da equipe ficam folgados. O
  limite de 4 MB no upload continua no código por enquanto.
- Sem pausa por uso: o Railway cobra o excedente. Por isso o limite de gasto
  com alerta.
- O site continua na rede da Vercel, que é o que o deixa rápido para o
  visitante e para o Google.
