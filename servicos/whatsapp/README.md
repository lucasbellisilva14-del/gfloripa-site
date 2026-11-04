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
| `JANELA_DIAS` | não | 7 | Quantos dias para trás aceitar ao conectar |
| `LOG_LEVEL` | não | warn | Nível de registro da biblioteca |

## Por que fica fora da Vercel

A conexão do WhatsApp é um socket que precisa ficar aberto. A Vercel executa
funções curtas e as encerra, então a sessão cairia a cada poucos segundos.
Por isso a ponte roda em um serviço comum, sempre ligado, e conversa com o
painel por HTTP.
