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
  para a conversa não ficar com buracos;
- o que ficou na fila enquanto o serviço esteve fora do ar, dentro da janela
  de dias abaixo.

O que ela ignora de propósito: grupos, listas de transmissão, status, canais
e reações.

**Janela de dias.** Ao conectar, o WhatsApp pode entregar de uma vez o que
estava acumulado. A ponte aceita o que for dos últimos 7 dias e descarta o
mais antigo, para não arrastar meses de conversa para dentro do painel. Dá
para mudar com a variável `JANELA_DIAS` no serviço. Conversa anterior a essa
janela não é importada: se quiser uma antiga no painel, exporte pelo WhatsApp
e use a tela de analisar conversa.

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

### 2. Aplicar as migrations no Supabase

No Supabase, em SQL Editor, New query, cole e rode, nesta ordem:

1. `supabase/migrations/20261103120000_painel_whatsapp.sql`: cria as quatro
   tabelas (`whatsapp_estado`, `whatsapp_sessao`, `whatsapp_chats`,
   `whatsapp_mensagens`).
2. `supabase/migrations/20261104120000_painel_whatsapp_v2.sql`: adiciona o
   canal de comando, o diagnóstico e o controle de mensagens novas por
   conversa. Sem ela, os botões da tela e a contagem de novas não funcionam.

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

## Controle pela tela

A tela `/painel/whatsapp` mostra a situação real do serviço e tem três botões:

- **Verificar agora**: pede um sinal de vida imediato.
- **Reconectar**: derruba e refaz a conexão com o WhatsApp, sem novo QR.
- **Parear de novo**: encerra a sessão atual e gera um QR novo. Use quando
  trocar de celular ou quando a sessão ficar inválida.

Os comandos chegam ao serviço de dois jeitos. Pela **fila**, que funciona
sempre: a tela grava o pedido e o serviço pergunta a cada 5 segundos se há
algo. Ou **direto**, imediato: se o serviço tiver um domínio público na
hospedagem e ele estiver em `WHATSAPP_PONTE_URL` na Vercel, o painel chama o
serviço na hora e ainda mostra a saúde em tempo real, sem esperar o pulso.

Para ligar o modo direto no Railway: no serviço, Settings, Networking,
**Generate Domain**. Copie o endereço gerado (algo como
`nagamboa-whatsapp-ponte-production.up.railway.app`) e coloque na Vercel:

| Variável | Valor |
| --- | --- |
| `WHATSAPP_PONTE_URL` | `https://<dominio-gerado>` |
| `WHATSAPP_HOSPEDAGEM_URL` | opcional: link do painel do Railway, vira o botão "abrir" quando o serviço cai |

Redeploy na Vercel depois. O endereço de saúde do serviço (`/saude`) responde
sem token e não expõe mensagem nenhuma, só status e contadores. O comando
(`POST /comando`) exige o token.

### Como a tela decide se o serviço está vivo

Duas fontes: o sinal de vida que o serviço grava no banco a cada 30 segundos
(pela fila, sempre funciona) e a resposta do endereço direto, quando
configurado. **Qualquer uma das duas prova que está vivo.** Só é "Serviço
fora do ar" quando nenhuma responde. Se o endereço direto falhar mas o pulso
estiver recente, a tela mostra o estado real (inclusive o QR) e acusa o
endereço direto como problema de configuração, sem bloquear nada.

Enquanto a conexão não está estável, a tela consulta a cada 2 segundos; nos
25 segundos seguintes a um botão, a cada segundo, com um contador visível. O
serviço, por sua vez, consulta a fila a cada 1,5 segundo durante os dois
minutos seguintes a qualquer comando ou mudança de conexão, e a cada 5 fora
disso.

### A lista de verificações

Abaixo do status aparecem as verificações, cada uma com o motivo:

1. **Serviço no ar**: respondeu no endereço direto ou mandou sinal de vida
   nos últimos 95 segundos (ele avisa a cada 30).
1. **Endereço direto do serviço** (só aparece com `WHATSAPP_PONTE_URL`):
   se responde. Quando falha com o serviço vivo pela outra via, o problema é
   o domínio ou a porta configurados no Railway, e os botões seguem
   funcionando pela fila.
2. **Pareado com o WhatsApp**: há sessão aberta com o número.
3. **Apontando para este painel**: o `PAINEL_URL` do serviço é o endereço da
   tela aberta. Se estiver mandando para um preview ou para o endereço errado,
   acusa aqui.
4. **Vendo mensagens**: quantas a biblioteca entregou ao serviço desde que
   subiu. Conectado há mais de dois minutos sem ver nenhuma é suspeito.
5. **Entregando ao painel**: quantas chegaram ao painel e quantas falharam,
   com o último erro.

Com essas cinco é possível dizer onde a corrente quebrou sem abrir os
registros da hospedagem. A linha de rodapé mostra a versão (commit) que o
serviço está rodando, o que responde se o deploy novo já subiu.

## Uso no dia a dia

Cada conversa mostra nome, telefone, a temperatura do cliente vinculado,
quantas mensagens chegaram desde a última análise ("novas") e a última
mensagem. **Ler** abre a conversa ali mesmo, em balões, para você conferir
antes de gastar uma análise. **Analisar** monta a transcrição e manda para a
I.A., exatamente como se você tivesse colado o texto na tela de análise. O
resultado é o mesmo: temperatura, fatos, insights, próxima mensagem, nota
para o Jetimob e lembretes. **Analisar todas com novidades** faz isso em
sequência para todas as conversas com mensagens novas, com confirmação do
custo antes. Há uma busca por nome, telefone ou trecho.

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

## No deploy, duas instâncias por alguns segundos

A hospedagem sobe a versão nova antes de derrubar a antiga. As duas tentam
usar a mesma sessão, e o WhatsApp só aceita uma: a outra recebe "conexão
substituída". A antiga, ao receber isso, **encerra em vez de reconectar**,
senão derrubaria a nova e as duas ficariam se revezando para sempre. Nos
registros aparece "outra instância do serviço assumiu a conexão". É normal
uma vez por deploy.

## Problemas comuns

**A tela diz que o serviço está numa versão antiga.** O serviço responde,
mas sem número de versão e sem diagnóstico: a hospedagem está servindo um
build anterior aos últimos deploys, e versões antigas descartam as mensagens
que você envia do celular. No Railway, aba Deployments: a última implantação
bem-sucedida tem que ser do dia do último merge. Se houver implantações com
falha, o registro do build diz por quê. Use Redeploy. Em Settings, confira
Source: branch `main` e Root Directory `servicos/whatsapp`. Para conferir à
mão, abra `https://<dominio-do-servico>/saude` no navegador: o serviço atual
devolve um campo `versao` com o commit em execução.

**O código QR não aparece.** O serviço não está no ar, ou `PAINEL_URL` e
`PAINEL_WHATSAPP_TOKEN` não batem entre o Railway e a Vercel. Veja os
registros no Railway: a ponte imprime o motivo.

**Status fica em Conectando e volta para Desconectado.** Normalmente é sessão
inválida. Use **Parear de novo** na tela, ou desconecte o aparelho pelo
celular, em Aparelhos conectados.

**Desconectei pelo celular e a tela não oferece o QR.** O serviço gera o QR
sozinho em poucos segundos ao perceber a desconexão. Se a tela não mostrar,
clique em **Parear de novo**; o contador abaixo do aviso acompanha a resposta.
Se o aviso vermelho disser que o serviço não responde, aí é na hospedagem.

**Conectou mas não chega mensagem.** Primeiro confira os registros do Railway:
a cada lote a ponte escreve uma linha como `lote notify: 1 aceita(s)`, ou diz
o motivo de ter ignorado (`nao e conversa de pessoa`, `sem texto`, `fora da
janela de dias`). Se não aparecer linha nenhuma, a conexão caiu. Lembre que
grupos não entram, e que conversa mais antiga que a janela de dias é
descartada.

**Mensagens duplicadas.** Não acontece: o painel ignora pelo id da mensagem no
WhatsApp.

## Verificação

Com o painel rodando em modo demonstração e o token configurado:

```bash
node scripts/qa-whatsapp.mjs http://localhost:3000 token-de-teste   # rotas do painel, simulando o serviço
node scripts/qa-ponte.mjs http://localhost:3000 token-de-teste      # o serviço de verdade, sem WhatsApp
```

O segundo sobe `servicos/whatsapp/index.mjs` apontando para o painel local e
confere pulso com diagnóstico, versão, endereço de saúde, comando direto e
comando pela fila. A conexão com o WhatsApp falha de propósito; o que se testa
é a conversa entre serviço e painel. Com `ESPERA_DIRETO=1` e o painel subido
com `WHATSAPP_PONTE_URL=http://localhost:18080`, testa o caminho direto.

São 23 verificações cobrindo recusa sem token, gravação de estado e sessão,
descarte de grupos e mensagens vazias, bloqueio de duplicadas, análise de uma
conversa e vínculo com a ficha do cliente. O `scripts/qa-painel.mjs` cobre a
tela.
