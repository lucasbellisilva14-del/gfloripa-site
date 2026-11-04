# Ponte do WhatsApp

Serviço que mantém a conexão do WhatsApp e repassa as mensagens ao Painel do
Corretor. **Somente leitura: nunca envia mensagem.**

Documentação completa, com instalação no Railway e os riscos envolvidos:
[`docs/painel/whatsapp.md`](../../docs/painel/whatsapp.md).

## Rodar local

```bash
cd servicos/whatsapp
npm install
PAINEL_URL=http://localhost:3000 PAINEL_WHATSAPP_TOKEN=token-de-teste npm start
```

O painel precisa estar no ar com o mesmo `PAINEL_WHATSAPP_TOKEN`. O código QR
aparece em `/painel/whatsapp`, não no terminal.

## Variáveis

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `PAINEL_URL` | sim | | Endereço do painel, sem barra no fim |
| `PAINEL_WHATSAPP_TOKEN` | sim | | Mesmo valor configurado na Vercel |
| `PORTA` | não | 8080 | Porta do endereço de saúde |
| `INTERVALO_ENVIO_MS` | não | 3000 | Agrupamento antes de enviar ao painel |
| `INTERVALO_PULSO_MS` | não | 30000 | Sinal de vida ao painel, com diagnóstico |
| `INTERVALO_COMANDO_MS` | não | 5000 | Consulta da fila de comandos no painel |
| `JANELA_DIAS` | não | 7 | Quantos dias para trás aceitar ao conectar |
| `LOG_LEVEL` | não | warn | Nível de registro da biblioteca |

## Endereços HTTP

| Rota | Autenticação | Para quê |
| --- | --- | --- |
| `GET /saude` (ou `/`) | nenhuma | status, versão, fila e contadores; sempre 200 |
| `POST /comando` | `Authorization: Bearer <token>` | `{ "comando": "pulso" \| "reconectar" \| "parear_novamente" }` |

Com o domínio público do serviço em `WHATSAPP_PONTE_URL` na Vercel, o painel
usa esses endereços direto. Sem ele, o serviço consulta a fila do painel.

## Railway: três ajustes que não vêm ligados

1. **Root Directory** = `servicos/whatsapp` (Settings, Source). Sem isso o
   Railway tenta construir o site inteiro.
2. **Implantações automáticas ligadas** para o branch `main` (Settings,
   Deploy triggers ou Automatic deployments). Vem desligado em alguns fluxos
   de criação: o primeiro deploy acontece e os merges seguintes são
   ignorados em silêncio. O sintoma no painel é "Serviço no ar" em vermelho
   com o aviso de versão antiga.
3. **Generate Domain** (Settings, Networking), para o painel chamar o serviço
   direto via `WHATSAPP_PONTE_URL`.

"Redeploy" em um deploy antigo reconstrói aquele mesmo commit; para subir o
código atual é preciso um push novo no `main` ou um deploy manual.

## Por que fica fora da Vercel

A conexão do WhatsApp é um socket que precisa ficar aberto. A Vercel executa
funções curtas e as encerra, então a sessão cairia a cada poucos segundos.
Por isso a ponte roda em um serviço comum, sempre ligado, e conversa com o
painel por HTTP.
