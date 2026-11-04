#!/usr/bin/env node
// Ponte somente leitura entre o WhatsApp e o Painel do Corretor.
//
// O que faz: mantém a conexão do WhatsApp (biblioteca Baileys, a mesma do
// WhatsApp Web), lê as mensagens que chegam e as que você envia pelo celular,
// e repassa tudo ao painel por HTTP. A sessão fica guardada no painel, para
// reiniciar sem precisar parear de novo.
//
// O que NÃO faz, de propósito: nunca envia mensagem, nunca entra em grupo,
// nunca marca conversa como lida e nunca aparece como online. Enviar é o que
// mais provoca bloqueio de número, e responder continua sendo no seu
// WhatsApp normal.
//
// Variáveis necessárias:
//   PAINEL_URL            ex.: https://www.nagamboaimoveis.com.br
//   PAINEL_WHATSAPP_TOKEN mesmo valor configurado na Vercel
// Opcionais:
//   PORTA                 porta do endereço de saúde (padrão 8080)
//   INTERVALO_ENVIO_MS    agrupamento de mensagens antes de enviar (padrão 3000)
//   JANELA_DIAS           quantos dias para trás aceitar ao conectar (padrão 7)

import { createServer } from 'node:http'
import makeWASocket, {
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  proto,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import { JANELA_DIAS_PADRAO, prepararMensagem, tipoAceito } from './filtros.mjs'

const PAINEL_URL = (process.env.PAINEL_URL ?? '').replace(/\/$/, '')
const TOKEN = process.env.PAINEL_WHATSAPP_TOKEN ?? ''
const PORTA = Number(process.env.PORTA ?? process.env.PORT ?? 8080)
const INTERVALO_ENVIO_MS = Number(process.env.INTERVALO_ENVIO_MS ?? 3000)
// quantos dias para tras aceitamos ao conectar, quando o WhatsApp entrega
// de uma vez o que ficou acumulado
const JANELA_DIAS = Number(process.env.JANELA_DIAS ?? JANELA_DIAS_PADRAO)

if (!PAINEL_URL || !TOKEN) {
  console.error('Faltam PAINEL_URL e/ou PAINEL_WHATSAPP_TOKEN. Veja docs/painel/whatsapp.md.')
  process.exit(1)
}

const log = pino({ level: process.env.LOG_LEVEL ?? 'warn' })
const agora = () => new Date().toISOString().slice(11, 19)
const diga = (...args) => console.log(`[${agora()}]`, ...args)

// --- conversa com o painel -------------------------------------------------

async function painel(caminho, opcoes = {}) {
  const res = await fetch(`${PAINEL_URL}/api/painel/whatsapp/${caminho}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...(opcoes.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`painel ${caminho}: ${res.status} ${await res.text().catch(() => '')}`)
  return res.status === 204 ? null : res.json()
}

async function publicarEstado(patch) {
  try {
    await painel('estado', { method: 'POST', body: JSON.stringify(patch) })
  } catch (err) {
    diga('não consegui publicar o estado:', err.message)
  }
}

// --- sessão guardada no painel --------------------------------------------
// O Baileys espera um objeto { creds, keys }. Guardamos os dois em uma única
// linha no banco, serializados com o BufferJSON da própria biblioteca.

async function carregarSessao() {
  try {
    const { dados } = await painel('sessao')
    if (!dados) return null
    return JSON.parse(JSON.stringify(dados), BufferJSON.reviver)
  } catch (err) {
    diga('não consegui carregar a sessão:', err.message)
    return null
  }
}

let salvandoSessao = null
let sessaoSuja = false

function agendarSalvarSessao(estado) {
  sessaoSuja = true
  if (salvandoSessao) return
  salvandoSessao = setTimeout(async () => {
    salvandoSessao = null
    if (!sessaoSuja) return
    sessaoSuja = false
    try {
      const dados = JSON.parse(JSON.stringify({ creds: estado.creds, keys: estado.keys }, BufferJSON.replacer))
      await painel('sessao', { method: 'PUT', body: JSON.stringify({ dados }) })
    } catch (err) {
      diga('não consegui salvar a sessão:', err.message)
      sessaoSuja = true
    }
  }, 2000)
}

// Monta o estado de autenticação no formato que o Baileys espera, por cima de
// um objeto simples que vive em memória e é persistido no painel.
function montarAuth(salvo) {
  const estado = { creds: salvo?.creds ?? initAuthCreds(), keys: salvo?.keys ?? {} }
  const keys = {
    get: (tipo, ids) => {
      const saida = {}
      const grupo = estado.keys[tipo] ?? {}
      for (const id of ids) {
        let valor = grupo[id]
        if (tipo === 'app-state-sync-key' && valor) valor = proto.Message.AppStateSyncKeyData.fromObject(valor)
        if (valor) saida[id] = valor
      }
      return saida
    },
    set: (dados) => {
      for (const tipo of Object.keys(dados)) {
        estado.keys[tipo] = estado.keys[tipo] ?? {}
        for (const id of Object.keys(dados[tipo])) {
          const valor = dados[tipo][id]
          if (valor) estado.keys[tipo][id] = valor
          else delete estado.keys[tipo][id]
        }
      }
      agendarSalvarSessao(estado)
    },
  }
  return {
    estado,
    auth: { creds: estado.creds, keys: makeCacheableSignalKeyStore(keys, log) },
    salvarCreds: () => agendarSalvarSessao(estado),
  }
}

// --- fila de mensagens -----------------------------------------------------
// Agrupa o que chega por alguns segundos, para não bater no painel a cada
// mensagem de uma conversa movimentada.

const fila = []
let enviando = false
let totalEnviadas = 0
const INICIO = Date.now()

async function escoarFila() {
  if (enviando || fila.length === 0) return
  enviando = true
  const lote = fila.splice(0, 200)
  try {
    const r = await painel('entrada', { method: 'POST', body: JSON.stringify({ mensagens: lote }) })
    totalEnviadas += lote.length
    if (r?.novas) diga(`${r.novas} mensagem(ns) nova(s) gravada(s) no painel`)
    else diga(`${lote.length} mensagem(ns) enviada(s), nenhuma nova (ja estavam no painel)`)
  } catch (err) {
    diga('falha ao enviar ao painel, tentando de novo depois:', err.message)
    fila.unshift(...lote) // devolve para a próxima rodada
  } finally {
    enviando = false
  }
}

setInterval(escoarFila, INTERVALO_ENVIO_MS)

// Pulso: sem isto, o painel mostraria "Conectado" para sempre depois que o
// serviço caísse, porque nada atualizaria aquele registro. A tela compara o
// horário do último pulso com a hora atual para saber se ainda está de pé.
const INTERVALO_PULSO_MS = Number(process.env.INTERVALO_PULSO_MS ?? 120000)
setInterval(() => {
  if (!socket?.user) return
  publicarEstado({ status: 'conectado', numero: (socket.user.id ?? '').split(':')[0].split('@')[0] })
}, INTERVALO_PULSO_MS)

// --- conexão ---------------------------------------------------------------

let socket = null
let encerrando = false

async function conectar() {
  const salvo = await carregarSessao()
  const { auth, salvarCreds } = montarAuth(salvo)
  const { version } = await fetchLatestBaileysVersion()

  await publicarEstado({ status: 'conectando', detalhe: null })

  socket = makeWASocket({
    version,
    auth,
    logger: log,
    // nunca aparecer como online: as notificações continuam indo para o celular
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    browser: ['Painel Nagamboa', 'Chrome', '1.0.0'],
  })

  socket.ev.on('creds.update', salvarCreds)

  socket.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u

    if (qr) {
      diga('código QR gerado, aguardando leitura')
      const imagem = await QRCode.toDataURL(qr, { margin: 1, width: 400 }).catch(() => null)
      await publicarEstado({ status: 'aguardando_qr', qr: imagem, detalhe: null })
    }

    if (connection === 'open') {
      const numero = (socket.user?.id ?? '').split(':')[0].split('@')[0]
      diga('conectado como', numero, `| janela de ${JANELA_DIAS} dia(s) | painel: ${PAINEL_URL}`)
      await publicarEstado({ status: 'conectado', qr: null, numero, detalhe: null })
    }

    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode
      const motivo = Object.entries(DisconnectReason).find(([, v]) => v === codigo)?.[0] ?? codigo
      diga('conexão encerrada:', motivo)

      if (codigo === DisconnectReason.loggedOut) {
        // o celular desconectou este aparelho: apaga a sessão e espera um QR novo
        diga('sessão encerrada pelo celular, limpando credenciais')
        await painel('sessao', { method: 'DELETE' }).catch(() => {})
        if (!encerrando) setTimeout(conectar, 3000)
        return
      }

      await publicarEstado({ status: 'desconectado', qr: null, detalhe: `Reconectando (${motivo})` })
      if (!encerrando) setTimeout(conectar, 5000)
    }
  })

  socket.ev.on('messages.upsert', ({ messages, type }) => {
    // 'notify' é a mensagem que chega ao vivo; 'append' é a que você enviou do
    // celular ou a que ficou na fila enquanto o serviço estava fora do ar.
    // Os dois contam: sem 'append' a ponte perde metade da conversa.
    if (!tipoAceito(type)) return
    let aceitas = 0
    const recusas = {}
    for (const m of messages) {
      const r = prepararMensagem(m, { janelaDias: JANELA_DIAS })
      if (r.recusa) {
        recusas[r.recusa] = (recusas[r.recusa] ?? 0) + 1
        continue
      }
      fila.push(r.mensagem)
      aceitas++
    }
    if (aceitas || Object.keys(recusas).length) {
      const detalhe = Object.entries(recusas)
        .map(([motivo, n]) => `${n} ${motivo}`)
        .join(', ')
      diga(`lote ${type}: ${aceitas} aceita(s)${detalhe ? `, ignorada(s): ${detalhe}` : ''}`)
    }
    if (fila.length >= 50) escoarFila()
  })
}

// --- endereço de saúde (o Railway precisa de uma porta aberta) -------------

createServer((req, res) => {
  // sempre 200: enquanto o QR não é lido o serviço está saudável, só não
  // conectado, e um 503 aqui faria a hospedagem reiniciar tudo em laço
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      conectado: Boolean(socket?.user),
      numero: socket?.user?.id?.split(':')[0] ?? null,
      fila: fila.length,
      mensagensEnviadas: totalEnviadas,
      desde: new Date(INICIO).toISOString(),
    })
  )
}).listen(PORTA, () => diga(`saúde em http://localhost:${PORTA}`))

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, async () => {
    encerrando = true
    diga('encerrando')
    await escoarFila().catch(() => {})
    await publicarEstado({ status: 'desconectado', qr: null, detalhe: 'Serviço encerrado' }).catch(() => {})
    process.exit(0)
  })
}

process.on('unhandledRejection', (e) => diga('erro não tratado:', e?.message ?? e))

conectar().catch(async (err) => {
  diga('falha ao iniciar:', err.message)
  await publicarEstado({ status: 'desconectado', detalhe: err.message.slice(0, 200) })
  process.exit(1)
})
