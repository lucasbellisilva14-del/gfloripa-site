# Ponte do WhatsApp (somente leitura)

Liga o seu WhatsApp ao Painel do Corretor. As conversas entram sozinhas no
painel, a I.A. analisa quando você pedir, e cada contato vira uma ficha de
cliente com temperatura, fatos e lembretes.

**O painel nunca envia mensagem.** Você continua respondendo pelo WhatsApp
de sempre, no celular ou no WhatsApp Web. Isso é uma decisão de projeto, não
uma limitação técnica, e está explicada na seção de risco abaixo.

## Como funciona

```
WhatsApp  ──QR──▶  servicos/whatsapp   ──HTTP (token)──▶  /api/painel/whatsapp/*
 (celular)         (Railway, sempre on)                   (Vercel)  ──▶ Supabase
```

O serviço da ponte usa a biblioteca Baileys, que fala o mesmo protocolo do
WhatsApp Web. Ele não guarda nada: repassa ao painel, e o painel grava no
Supabase. Até a sessão do WhatsApp fica no painel, para o serviço reiniciar
sem você precisar parear de novo.

O que a ponte captura:

- mensagens recebidas e as que você envia pelo celular, em conversas de pessoa;
- texto. Foto, áudio e documento viram uma marcação curta, como `[áudio]`,
  para a conversa não ficar com buracos.

O que ela ignora de propósito: grupos, listas de transmissão, status,
mensagens antigas (só vale o que chega depois de conectar) e reações.

E o que ela nunca faz: enviar mensagem, entrar em grupo, marcar conversa como
lida ou aparecer como online. Suas notificações continuam indo normalmente
para o celular.

## O risco, em uma linha

Isso usa uma biblioteca não oficial e fere os termos de uso do WhatsApp. Há
risco de bloqueio do número. O risco é bem menor neste formato, porque o que
costuma derrubar número é disparo em massa e mensagem para quem nunca
procurou você, e aqui não existe nenhum envio. Mas não é zero, e o número é a
sua carteira. A decisão de usar é sua, com os olhos abertos.

O caminho oficial, sem esse risco, é a Cloud API do WhatsApp Business com o
modo Coexistence, que permite manter o mesmo número no celular. É mais
trabalhoso, exige empresa verificada na Meta e tem custo por mensagem. Está no
roteiro, caso um dia valha a troca.

## Instalação

### 1. Criar o token compartilhado

É a senha entre a ponte e o painel. Gere um valor aleatório:

```bash
openssl rand -hex 32
```

### 2. Aplicar a migration no Supabase

No Supabase, em SQL Editor, New query, cole e rode o arquivo
`supabase/migrations/20261103120000_painel_whatsapp.sql`. Ele cria quatro
tabelas: `whatsapp_estado`, `whatsapp_sessao`, `whatsapp_chats` e
`whatsapp_mensagens`.

### 3. Configurar o painel na Vercel

Em Settings, Environment Variables, adicione, marcando Production e Preview:

| Variável | Valor |
| --- | --- |
| `PAINEL_WHATSAPP_TOKEN` | o token do passo 1 |

Faça Redeploy. Sem essa variável a tela `/painel/whatsapp` avisa que a ponte
não está configurada e as rotas da ponte respondem 503.

### 4. Subir o serviço no Railway

1. Em railway.app, New Project, Deploy from GitHub repo, escolha
   `gfloripa-site`.
2. Em Settings do serviço, defina **Root Directory** como `servicos/whatsapp`.
   Isso faz o Railway instalar e rodar só a ponte, não o site.
3. O comando de start já vem do `package.json` (`npm start`). Não precisa mexer.
4. Em Variables, adicione:

| Variável | Valor |
| --- | --- |
| `PAINEL_URL` | `https://www.nagamboaimoveis.com.br` |
| `PAINEL_WHATSAPP_TOKEN` | o mesmo token do passo 1 |

5. Opcional: `LOG_LEVEL=info` para ver mais detalhe nos registros, e
   `INTERVALO_ENVIO_MS` para mudar o agrupamento de mensagens (padrão 3000 ms).

O serviço abre uma porta de saúde que responde em `/` com o estado da
conexão. O Railway usa isso para saber que está vivo.

### 5. Parear o celular

Abra `/painel/whatsapp` no painel. Em até um minuto o código QR aparece.
No celular: WhatsApp, três pontinhos, Aparelhos conectados, Conectar um
aparelho, e aponte para o código. O status vira Conectado e as conversas
começam a entrar conforme chegam mensagens novas.

Se o código expirar, a tela busca outro sozinha.

## Uso no dia a dia

Na tela `/painel/whatsapp` cada conversa mostra o nome do contato, quantas
mensagens já foram capturadas e a última delas. O botão **Analisar** monta a
transcrição e manda para a I.A., exatamente como se você tivesse colado o
texto na tela de análise. O resultado é o mesmo: temperatura, fatos, insights,
próxima mensagem, nota para o Jetimob e lembretes.

Depois da primeira análise, a conversa fica ligada à ficha do cliente. As
análises seguintes caem na mesma ficha, e a evolução da temperatura aparece
na página dele.

**Arquivar** tira a conversa da lista, para contatos pessoais e grupos de
amigos não poluírem o painel. Nada é apagado.

## Custo

Railway cobra por uso; um serviço pequeno como esse fica na casa de cinco
dólares por mês. Cada análise da I.A. custa o mesmo de sempre, entre três e
cinco centavos de dólar, e só acontece quando você clica em Analisar. A
captura das mensagens em si não custa nada de I.A.

## Privacidade (LGPD)

A ponte transporta conversas de clientes, que são dados pessoais. Pontos de
atenção:

- O serviço não grava nada em disco; tudo vai para o seu Supabase.
- A tabela `whatsapp_sessao` guarda as credenciais da sua conta do WhatsApp.
  Trate como segredo: quem tiver acesso a ela pode ler suas conversas.
- As rotas da ponte são autenticadas por token, e as telas, por login.
- Vale citar a finalidade na política de privacidade do site.

## Problemas comuns

**O código QR não aparece.** O serviço não está no ar, ou `PAINEL_URL` e
`PAINEL_WHATSAPP_TOKEN` não batem entre o Railway e a Vercel. Veja os
registros no Railway: a ponte imprime o motivo.

**Status fica em Conectando e volta para Desconectado.** Normalmente é sessão
inválida. Desconecte o aparelho pelo celular, em Aparelhos conectados, e
pareie de novo.

**Conectou mas não chega mensagem.** Só entram mensagens novas, a partir do
pareamento. Mande uma mensagem de teste para você mesmo de outro número.

**Mensagens duplicadas.** Não acontece: o painel ignora pelo id da mensagem no
WhatsApp.

## Verificação

Com o painel rodando em modo demonstração e o token configurado:

```bash
node scripts/qa-whatsapp.mjs http://localhost:3000 token-de-teste
```

São 23 verificações cobrindo recusa sem token, gravação de estado e sessão,
descarte de grupos e mensagens vazias, bloqueio de duplicadas, análise de uma
conversa e vínculo com a ficha do cliente. O `scripts/qa-painel.mjs` cobre a
tela.
