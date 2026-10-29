# API do Jetimob: o que dá para escrever a partir do painel

Levantamento feito em 29/10/2026 para decidir se o botão "Enviar para o
Jetimob" podia gravar nota, histórico ou tarefa no lead. Conclusão curta:
**não há endpoint público documentado para isso**; só criação de lead.

## O que já usamos (confirmado no código do site)

| Uso | Endpoint | Autenticação |
| --- | --- | --- |
| Listar imóveis | `GET {JETIMOB_API_URL}/{JETIMOB_API_KEY}/imoveis?v=6&page=&pageSize=` | chave Webservice na URL |
| Imóveis ativos | `GET .../imoveis-ativos` | idem |
| Detalhe | `GET .../imoveis/codigo/{codigo}?v=6` | idem |
| Condomínios | `GET .../condominios?v=6` | idem |
| Corretores | `GET .../corretores` | idem |
| Criar lead | `POST https://api.jetimob.com/leads/{JETIMOB_PUBLIC_KEY}` (multipart) | header `Authorization-Key: {JETIMOB_PRIVATE_KEY}` |

Campos aceitos no POST de leads (ver `createLead` em `src/lib/jetimob.ts`):
`full_name`, `email`, `phone`, `message`, `property_code`, `responsible`
(e-mail do corretor), `subject`, `source`, `prospecting_supply_id` (origem),
`url`, `gclid`, `utm_*`.

## O que foi pesquisado

- A documentação oficial fica em https://docs.jetimob.com. Nesta sessão de
  desenvolvimento o acesso ao domínio foi bloqueado pela política de rede,
  então a leitura direta não foi possível; a pesquisa se baseou em buscas
  na web e em integrações de terceiros.
- Fontes de terceiros (conector de dados Nekt; pacote npm
  `@horizon-integrations/jetimob-crm`) descrevem a mesma superfície: chave
  Webservice para imóveis e condomínios, e par de chaves pública/privada
  para a rota de leads (GET e POST). Nenhuma menciona endpoint de
  anotação, histórico, tarefa, agenda ou atualização de funil.
- A central de ajuda do Jetimob descreve integrações por Make e RD Station,
  ambas restritas a **criar lead** (com código do imóvel e distribuição
  pela roleta de corretores).
- O Jetimob oferece **webhooks** (evento de lead criado e eventos de
  negociação), úteis para a fase 2 (receber do CRM), mas não para escrever
  nele.

Links consultados: https://docs.jetimob.com/ (bloqueado aqui),
https://ajuda.jetimob.com/como-integrar-site-exclusivo-sistema-jetimob,
https://ajuda.jetimob.com/como-integrar-facebook-leads-ads-com-sistema-jetimob-pela-make,
https://docs.nekt.com/sources/jetimob, https://www.jetimob.com/recursos/webhooks,
https://ajuda.rdstation.com/s/article/Integrar-Jetimob-ao-RD-Station-Marketing.

## Decisão para a fase 1

1. O texto pronto para o Jetimob fica sempre disponível para **copiar** e
   colar no histórico do lead.
2. O botão **"Enviar para o Jetimob"** existe, mas só aparece com
   `PAINEL_JETIMOB_ENVIO=1`. Ele usa o POST de leads com a nota como
   `message`: o Jetimob agrupa pelo telefone/e-mail e registra como novo
   atendimento do mesmo contato (comportamento observado com o chat da
   Lia, que já cria leads por esse caminho). Efeitos colaterais a validar
   antes de ligar em produção: o lead pode cair na roleta de distribuição
   e gerar notificação para outro corretor; por isso o envio passa
   `responsible` com o e-mail do corretor logado (`PAINEL_CORRETOR_EMAIL`).
3. Toda escrita passa por `src/lib/painel/jetimob-escrita.ts`. Quando a
   Jetimob disponibilizar o MCP (previsto pelo Lucas) ou endpoints de
   escrita, só essa camada muda: anotar histórico, criar tarefa com data,
   mover etapa do funil e atualizar temperatura passam a ser chamadas
   diretas, e a tela já tem os dados prontos (`texto_jetimob`, `lembretes`,
   `estagio`, `temperatura`).

## Para confirmar com o suporte do Jetimob

- Existe endpoint para anotação/histórico em lead ou negociação existente?
- Existe endpoint para criar tarefa/compromisso na agenda do corretor?
- O POST de leads com telefone já cadastrado atualiza o contato existente
  ou cria duplicado? Respeita `responsible` quando a roleta está ativa?
- Prazo e escopo do MCP oficial.
