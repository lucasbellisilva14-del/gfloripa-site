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
// Como o painel fala com este serviço:
//   - pela fila: o serviço pergunta ao painel a cada 5 s se há comando;
//   - direto: se a hospedagem tiver domínio público, o painel chama
//     POST /comando e GET /saude aqui, com o mesmo token, na hora.
// Comandos: reconectar, parear_novamente, pulso.
//
// Variáveis necessárias:
//   PAINEL_URL            ex.: https://www.nagamboaimoveis.com.br
//   PAINEL_WHATSAPP_TOKEN mesmo valor configurado na Vercel
// Opcionais:
//   PORTA / PORT          porta HTTP (padrão 8080)
//   INTERVALO_ENVIO_MS    agrupamento de mensagens antes de enviar (padrão 3000)
//   INTERVALO_PULSO_MS    sinal de vida ao painel (padrão 30000)
//   INTERVALO_COMANDO_MS  consulta da fila de comandos (padrão 5000)
//   JANELA_DIAS           quantos dias para trás aceitar ao conectar (padrão 7)
//   LOG_LEVEL             nível de registro da biblioteca (padrão warn)

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
const INTERVALO_PULSO_MS = Number(process.env.INTERVALO_PULSO_MS ?? 30000)
const INTERVALO_COMANDO_MS = Number(process.env.INTERVALO_COMANDO_MS ?? 5000)
const JANELA_DIAS = Number(process.env.JANELA_DIAS ?? JANELA_DIAS_PADRAO)
// A hospedagem informa o commit em execução; é como a tela sabe se o deploy
// novo já está no ar.
const VERSAO = (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? process.env.SOURCE_VERSION ?? 'local').slice(0, 7)
const INICIO = new Date().toISOString()

if (!PAINEL_URL || !TOKEN) {
  console.error('Faltam PAINEL_URL e/ou PAINEL_WHATSAPP_TOKEN. Veja docs/painel/whatsapp.md.')
  process.exit(1)
}

const log = pino({ level: process.env.LOG_LEVEL ?? 'warn' })
const agora = () => new Date().toISOString().slice(11, 19)
const diga = (...args) => console.log(`[${agora()}]`, ...args)

// --- diagnóstico que vai no sinal de vida -----------------------------------

const diag = {
  vistas: 0, // mensagens que a biblioteca entregou
  aceitas: 0, // passaram nos filtros
  enviadas: 0, // entregues ao painel
  falhas_envio: 0,
  ultima_vista_em: null,
  ultimo_erro: null,
}

function registrarErro(msg) {
  diag.ultimo_erro = `${new Date().toISOString().slice(0, 16)} ${msg}`.slice(0, 300)
}

// --- conversa com o painel -------------------------------------------------

async function painel(caminho, opcoes = {}) {
  const res = await fetch(`${PAINEL_URL}/api/painel/whatsapp/${caminho}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, ...(opcoes.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`painel ${caminho}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

function estadoAtual() {
  return socket?.user ? 'conectado' : statusInformado
}

let statusInformado = 'desconectado'

async function publicarEstado(patch) {
  if (patch.status) statusInformado = patch.status
  try {
    await painel('estado', {
      method: 'POST',
      body: JSON.stringify({
        ...patch,
        diagnostico: {
          ...diag,
          versao: VERSAO,
          desde: INICIO,
          painel_url: PAINEL_URL,
        },
      }),
    })
  } catch (err) {
    diga('não consegui publicar o estado:', err.message)
    registrarErro(`publicar estado: ${err.message}`)
  }
}

// Confere, antes de tudo, se o painel aceita este token. Um 401 ou 503 aqui
// é erro de configuração, e fica claro no registro em vez de virar uma falha
// a cada mensagem.
async function conferirPainel() {
  for (;;) {
    try {
      await painel('sessao')
      return
    } catch (err) {
      const msg = err.message
      if (msg.includes(' 401')) diga('ERRO: o painel recusou o token. PAINEL_WHATSAPP_TOKEN precisa ser igual na Vercel e aqui.')
      else if (msg.includes(' 503')) diga('ERRO: o painel não tem PAINEL_WHATSAPP_TOKEN configurado (ou falta Redeploy na Vercel).')
      else if (msg.includes(' 404')) diga('ERRO: PAINEL_URL aponta para um site sem o painel. Confira o endereço:', PAINEL_URL)
      else diga('ERRO ao falar com o painel:', msg)
      registrarErro(msg)
      diga('tentando de novo em 30 segundos')
      await new Promise((r) => setTimeout(r, 30000))
    }
  }
}

// --- sessão guardada no painel --------------------------------------------

async function carregarSessao() {
  try {
    const { dados } = await painel('sessao')
    if (!dados) return null
    return JSON.parse(JSON.stringify(dados), BufferJSON.reviver)
  } catch (err) {
    diga('não consegui carregar a sessão:', err.message)
    registrarErro(`carregar sessão: ${err.message}`)
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
      registrarErro(`salvar sessão: ${err.message}`)
      sessaoSuja = true
    }
  }, 2000)
}

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

const fila = []
let enviando = false

async function escoarFila() {
  if (enviando || fila.length === 0) return
  enviando = true
  const lote = fila.splice(0, 200)
  try {
    const r = await painel('entrada', { method: 'POST', body: JSON.stringify({ mensagens: lote }) })
    diag.enviadas += lote.length
    if (r?.novas) diga(`${r.novas} mensagem(ns) nova(s) gravada(s) no painel`)
    else diga(`${lote.length} mensagem(ns) enviada(s), nenhuma nova (já estavam no painel)`)
  } catch (err) {
    diag.falhas_envio += 1
    registrarErro(`enviar ao painel: ${err.message}`)
    diga('falha ao enviar ao painel, tentando de novo depois:', err.message)
    fila.unshift(...lote)
  } finally {
    enviando = false
  }
}

setInterval(escoarFila, INTERVALO_ENVIO_MS)

// --- conexão ---------------------------------------------------------------

let socket = null
let encerrando = false
let reconectarAgendado = null

function agendarReconexao(ms) {
  if (encerrando || reconectarAgendado) return
  reconectarAgendado = setTimeout(() => {
    reconectarAgendado = null
    conectar().catch((err) => {
      diga('falha ao reconectar:', err.message)
      registrarErro(`reconectar: ${err.message}`)
      agendarReconexao(10000)
    })
  }, ms)
}

async function conectar() {
  if (socket) {
    try {
      socket.ev.removeAllListeners('connection.update')
      socket.ev.removeAllListeners('messages.upsert')
      socket.ev.removeAllListeners('creds.update')
      socket.end(undefined)
    } catch {
      // socket já fechado
    }
    socket = null
  }

  const salvo = await carregarSessao()
  const { auth, salvarCreds } = montarAuth(salvo)
  const { version } = await fetchLatestBaileysVersion()

  await publicarEstado({ status: 'conectando', detalhe: null })

  const s = makeWASocket({
    version,
    auth,
    logger: log,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    browser: ['Painel Nagamboa', 'Chrome', '1.0.0'],
  })
  socket = s

  s.ev.on('creds.update', salvarCreds)

  s.ev.on('connection.update', async (u) => {
    if (socket !== s) return // instância antiga, já substituída
    const { connection, lastDisconnect, qr } = u

    if (qr) {
      diga('código QR gerado, aguardando leitura')
      const imagem = await QRCode.toDataURL(qr, { margin: 1, width: 400 }).catch(() => null)
      await publicarEstado({ status: 'aguardando_qr', qr: imagem, detalhe: null })
    }

    if (connection === 'open') {
      const numero = (s.user?.id ?? '').split(':')[0].split('@')[0]
      diga(`conectado como ${numero} | versão ${VERSAO} | janela de ${JANELA_DIAS} dia(s) | painel: ${PAINEL_URL}`)
      await publicarEstado({ status: 'conectado', qr: null, numero, detalhe: null })
    }

    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode
      const motivo = Object.entries(DisconnectReason).find(([, v]) => v === codigo)?.[0] ?? String(codigo)
      diga('conexão encerrada:', motivo)

      if (codigo === DisconnectReason.loggedOut) {
        // o celular desconectou este aparelho: apaga a sessão e pede QR novo
        diga('sessão encerrada pelo celular, limpando credenciais')
        await painel('sessao', { method: 'DELETE' }).catch(() => {})
        agendarReconexao(3000)
        return
      }

      if (codigo === DisconnectReason.connectionReplaced) {
        // Outra instância assumiu a conexão: acontece no deploy, quando a
        // versão antiga e a nova rodam juntas por alguns segundos. Insistir
        // derrubaria a nova em ciclo. Sai e deixa a hospedagem decidir.
        diga('outra instância do serviço assumiu a conexão; esta encerra para não disputar')
        await publicarEstado({ detalhe: `Instância ${VERSAO} cedeu a conexão a outra` })
        encerrando = true
        setTimeout(() => process.exit(0), 2000)
        return
      }

      await publicarEstado({ status: 'desconectado', qr: null, detalhe: `Reconectando (${motivo})` })
      agendarReconexao(5000)
    }
  })

  s.ev.on('messages.upsert', ({ messages, type }) => {
    if (socket !== s) return
    diag.vistas += messages.length
    diag.ultima_vista_em = new Date().toISOString()
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
    diag.aceitas += aceitas
    if (aceitas || Object.keys(recusas).length) {
      const detalhe = Object.entries(recusas)
        .map(([motivo, n]) => `${n} ${motivo}`)
        .join(', ')
      diga(`lote ${type}: ${aceitas} aceita(s)${detalhe ? `, ignorada(s): ${detalhe}` : ''}`)
    }
    if (fila.length >= 50) escoarFila()
  })
}

// --- comandos --------------------------------------------------------------

async function executarComando(comando, origem) {
  diga(`comando "${comando}" (${origem})`)
  if (comando === 'pulso') {
    await publicarEstado({ status: estadoAtual() })
    return true
  }
  if (comando === 'reconectar') {
    await publicarEstado({ status: 'conectando', detalhe: 'Reconexão pedida pelo painel' })
    conectar().catch((err) => {
      diga('falha ao reconectar:', err.message)
      registrarErro(`reconectar: ${err.message}`)
      agendarReconexao(10000)
    })
    return true
  }
  if (comando === 'parear_novamente') {
    // encerra a sessão do lado do WhatsApp e apaga as credenciais: o próximo
    // início gera QR novo. Se o logout falhar (sessão já inválida), segue.
    try {
      await socket?.logout?.()
    } catch {
      // segue para a limpeza
    }
    await painel('sessao', { method: 'DELETE' }).catch(() => {})
    await publicarEstado({ status: 'conectando', qr: null, numero: null, detalhe: 'Novo pareamento pedido pelo painel' })
    conectar().catch((err) => {
      diga('falha ao iniciar novo pareamento:', err.message)
      registrarErro(`parear: ${err.message}`)
      agendarReconexao(10000)
    })
    return true
  }
  return false
}

async function consultarFilaDeComandos() {
  try {
    const { comando } = await painel('comando')
    if (comando) await executarComando(comando, 'fila')
  } catch (err) {
    // o painel fora do ar já aparece nos outros registros; aqui só evitamos ruído
    if (!String(err.message).includes(' 404')) registrarErro(`fila de comandos: ${err.message}`)
  }
}

// --- HTTP: saúde e comando direto ------------------------------------------

function lerCorpo(req) {
  return new Promise((resolve) => {
    let dados = ''
    req.on('data', (c) => {
      dados += c
      if (dados.length > 10000) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(dados || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

function autorizado(req) {
  const cab = req.headers.authorization ?? ''
  return cab === `Bearer ${TOKEN}`
}

createServer(async (req, res) => {
  const responder = (codigo, corpo) => {
    res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(corpo))
  }
  const url = new URL(req.url ?? '/', 'http://local')

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/saude')) {
    // sempre 200: enquanto o QR não é lido o serviço está saudável, só não
    // conectado, e um 503 aqui faria a hospedagem reiniciar tudo em laço
    return responder(200, {
      conectado: Boolean(socket?.user),
      status: estadoAtual(),
      numero: socket?.user?.id?.split(':')[0] ?? null,
      fila: fila.length,
      desde: INICIO,
      versao: VERSAO,
      diagnostico: diag,
    })
  }

  if (req.method === 'POST' && url.pathname === '/comando') {
    if (!autorizado(req)) return responder(401, { error: 'token inválido' })
    const { comando } = await lerCorpo(req)
    const ok = await executarComando(String(comando ?? ''), 'direto').catch(() => false)
    return responder(ok ? 200 : 400, { ok, comando })
  }

  responder(404, { error: 'não encontrado' })
}).listen(PORTA, () => diga(`HTTP em http://localhost:${PORTA} (saúde em /saude, comandos em POST /comando)`))

// --- ciclo de vida ---------------------------------------------------------

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, async () => {
    encerrando = true
    diga('encerrando')
    await escoarFila().catch(() => {})
    await publicarEstado({ status: 'desconectado', qr: null, detalhe: 'Serviço encerrado' }).catch(() => {})
    process.exit(0)
  })
}

process.on('unhandledRejection', (e) => {
  diga('erro não tratado:', e?.message ?? e)
  registrarErro(`não tratado: ${e?.message ?? e}`)
})

async function iniciar() {
  diga(`ponte versão ${VERSAO} iniciando | painel: ${PAINEL_URL}`)
  await conferirPainel()
  setInterval(() => publicarEstado({ status: estadoAtual() }), INTERVALO_PULSO_MS)
  setInterval(consultarFilaDeComandos, INTERVALO_COMANDO_MS)
  await conectar()
}

iniciar().catch(async (err) => {
  diga('falha ao iniciar:', err.message)
  registrarErro(`iniciar: ${err.message}`)
  await publicarEstado({ status: 'desconectado', detalhe: err.message.slice(0, 200) })
  process.exit(1)
})
