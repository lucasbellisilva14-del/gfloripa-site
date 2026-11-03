@AGENTS.md

# Nagamboa Imóveis — contexto do projeto

Site da Nagamboa Imóveis (Garopaba / Praia da Gamboa, SC), em produção em
https://www.nagamboaimoveis.com.br (Vercel, deploy automático da branch main).
Objetivo: autoridade da marca e tráfego pago no Google Ads.

## Regras do dono (obrigatórias)

- NUNCA usar travessão (—) ou meia-risca (–) em textos do site, titles,
  descriptions ou nas respostas da assistente Lia. Pontuação natural.
- Identidade visual: navy #0A1430 (fundos #0B1738/#10204A), dourado #E8B23A,
  fontes Marcellus (títulos) e Jost (texto). Estilos inline nos componentes;
  utilitárias e media queries em src/app/globals.css (breakpoint mobile 860px).
- Localização de imóvel no mapa é sempre aproximada (pino + raio); nunca
  mostrar endereço exato nem rota. O corretor envia a localização na negociação.
- Commits em português, claros. Sem dependências novas sem motivo forte.

## Arquitetura

- Next.js 16 (App Router) + Tailwind 4. Imagens com unoptimized: true (a cota
  do otimizador da Vercel estourava, HTTP 402); fotos vêm do CDN da Jetimob.
- Dados: API Jetimob webservice via src/lib/jetimob.ts (lista com cache de 10
  min via unstable_cache + memória; detalhe usa ?v=6 que embrulha em {data}).
- /imoveis filtra no NAVEGADOR (src/components/ImoveisBrowser.tsx) para
  fluidez; o servidor só entrega a lista enxuta. URL sincronizada com
  history.replaceState.
- Assistente "Lia" (src/app/api/chat/route.ts + ChatWidget): Claude Haiku com
  streaming NDJSON, ferramentas de busca e registro de lead no CRM Jetimob
  (corretor responsável + origem). Eventos de conversão em src/lib/gtag.ts
  (tag Google Ads AW-18509417111).
- Empreendimentos: condomínios da Jetimob; unidades casadas por vínculo do
  painel + heurística por nome/bairro. Carro-chefe fixado: Loteamento Mares de
  Garopaba (id_condominio 386780).
- Destaques da home ranqueiam: exclusividade > terrenos > Mares > Gamboa.
- Selo ★ EXCLUSIVO automático via campo exclusividade do painel.

## Painel do Corretor com I.A. (/painel)

- Área interna separada do site: src/app/(painel)/painel, src/app/api/painel,
  src/lib/painel, src/components/painel. Protegida por src/proxy.ts (cookie
  assinado) e senha única. Documentação completa em docs/painel/README.md;
  padrão de atendimento que treina a I.A. em src/painel/padrao-atendimento.md.
- Sem PAINEL_SENHA, SUPABASE_* e ANTHROPIC_API_KEY roda em modo demo (senha
  "demo", dados de exemplo, análise fixa). Nunca pode quebrar o site público.
- Testes: npm test (validador da análise) e node scripts/qa-painel.mjs (fluxo
  completo com Playwright, servidor no ar).

## Variáveis de ambiente (.env.local, NUNCA commitar)

- JETIMOB_API_URL=https://api.jetimob.com/webservice
- JETIMOB_API_KEY= (painel Jetimob → Integrações → Chaves API → Webservice)
- JETIMOB_PUBLIC_KEY= / JETIMOB_PRIVATE_KEY= (mesma tela, Pública e Privada;
  usadas pelo registro de leads)
- JETIMOB_LEAD_ORIGEM_ID=1597360 (origem oficial do CRM)
- ANTHROPIC_API_KEY= (console.anthropic.com; alimenta a Lia)
- NEXT_PUBLIC_ADS_LEAD_LABEL= (rótulo da conversão "Lead site" do Google Ads;
  pendente de configuração)
- Painel: PAINEL_SENHA, PAINEL_SESSION_SECRET, SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, PAINEL_ANTHROPIC_MODEL (opcionais; ver
  docs/painel/README.md)

As mesmas variáveis existem na Vercel (Settings → Environment Variables);
variável nova lá exige Redeploy.

## Comandos e verificação

- Dev: npm run dev (porta 3000)
- QA mobile (obrigatório após mexer em layout): suba o dev e rode
  `node scripts/qa-mobile.mjs` (50 testes em viewport de iPhone com Playwright;
  aceita URL de produção como argumento). Meta: 50/50.
- Build e lint precisam passar antes de push: npm run build / npm run lint.

## Pendências conhecidas (2026-10-28)

- Rótulo de conversão do Google Ads (NEXT_PUBLIC_ADS_LEAD_LABEL) para a
  conversão oficial contar; a tag base já está instalada.
- Política de privacidade LGPD (falta CNPJ/razão social do dono).
- Landing pages por região para campanhas.
- CRECI da corretora Marcia está vazio no painel Jetimob (o site oculta o
  rótulo nesse caso).
