#!/usr/bin/env node
// QA do serviço ponte de verdade (servicos/whatsapp/index.mjs) contra o painel,
// sem WhatsApp: sobe o serviço apontando para o painel local e confere o
// pulso com diagnóstico, a versão, o endereço de saúde, o comando direto e o
// comando pela fila. A conexão com o WhatsApp vai falhar (sem rede ou sem
// sessão), e isso não atrapalha: o que se testa é a conversa serviço-painel.
//
// Uso: node scripts/qa-ponte.mjs [painelURL] [token]
// Pré-requisito: painel no ar com PAINEL_WHATSAPP_TOKEN igual ao token.

import { spawn } from 'node:child_process'
import path from 'node:path'

const PAINEL = process.argv[2] ?? 'http://localhost:3000'
const TOKEN = process.argv[3] ?? process.env.PAINEL_WHATSAPP_TOKEN ?? 'token-de-teste'
const PORTA = 18080
let falhas = 0
const ok = (c, msg, extra = '') => {
  console.log(`${c ? 'OK   ' : 'FALHA'} ${msg}${extra ? ' :: ' + extra : ''}`)
  if (!c) falhas++
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const ponte = spawn('node', ['index.mjs'], {
  cwd: path.join(process.cwd(), 'servicos', 'whatsapp'),
  env: {
    ...process.env,
    PAINEL_URL: PAINEL,
    PAINEL_WHATSAPP_TOKEN: TOKEN,
    PORTA: String(PORTA),
    INTERVALO_PULSO_MS: '2000',
    INTERVALO_COMANDO_MS: '1000',
    RAILWAY_GIT_COMMIT_SHA: 'qa0000000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let registro = ''
ponte.stdout.on('data', (d) => (registro += d))
ponte.stderr.on('data', (d) => (registro += d))
const matar = () => {
  try {
    ponte.kill('SIGTERM')
  } catch {
    // já encerrado
  }
}
process.on('exit', matar)

try {
  // 1. serviço sobe e confere o painel
  let subiu = false
  for (let i = 0; i < 40 && !subiu; i++) {
    await espera(500)
    subiu = await fetch(`http://localhost:${PORTA}/saude`).then((r) => r.ok).catch(() => false)
  }
  ok(subiu, 'serviço subiu e responde em /saude')
  ok(registro.includes('iniciando'), 'registro de início com versão e painel')
  ok(!registro.includes('ERRO: o painel recusou'), 'painel aceitou o token')

  // 2. saúde sempre 200, com versão e diagnóstico, mesmo sem WhatsApp
  const saude = await fetch(`http://localhost:${PORTA}/saude`).then((r) => r.json())
  ok(saude.versao === 'qa00000', `versão vem do commit da hospedagem (${saude.versao})`)
  ok(saude.conectado === false, 'sem WhatsApp, conectado=false mas HTTP 200')
  ok(typeof saude.diagnostico?.vistas === 'number', 'diagnóstico presente na saúde')

  // 3. pulso chega ao painel com diagnóstico e versão
  await espera(3000)
  const login = await fetch(`${PAINEL}/api/painel/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ senha: process.env.PAINEL_SENHA ?? 'demo' }),
  })
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  ok(Boolean(cookie), 'login no painel para ler o estado')
  let est = await fetch(`${PAINEL}/api/painel/whatsapp/saude`, { headers: { cookie } }).then((r) => r.json())
  ok(est.estado?.diagnostico?.versao === 'qa00000', `pulso gravou a versão no painel (${est.estado?.diagnostico?.versao})`)
  ok(est.estado?.diagnostico?.painel_url === PAINEL, 'pulso informa para qual painel aponta')
  ok(typeof est.estado?.diagnostico?.vistas === 'number', 'pulso traz contadores')
  const primeiroPulso = est.estado?.atualizado_em
  await espera(2500)
  est = await fetch(`${PAINEL}/api/painel/whatsapp/saude`, { headers: { cookie } }).then((r) => r.json())
  ok(est.estado?.atualizado_em !== primeiroPulso, 'pulso se repete')

  // 4. comando direto no serviço (com token)
  let r = await fetch(`http://localhost:${PORTA}/comando`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer errado' },
    body: JSON.stringify({ comando: 'pulso' }),
  })
  ok(r.status === 401, 'comando direto sem token certo é recusado')
  r = await fetch(`http://localhost:${PORTA}/comando`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ comando: 'pulso' }),
  })
  const confirmacao = await r.json().catch(() => ({}))
  ok(r.ok && confirmacao.ok === true && confirmacao.comando === 'pulso', 'comando direto "pulso" aceito e confirmado ({ ok, comando })')
  r = await fetch(`http://localhost:${PORTA}/comando`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ comando: 'inexistente' }),
  })
  ok(r.status === 400, 'comando desconhecido é recusado')

  // 5. comando pela fila: a tela grava, o serviço consome em até 1 s (aqui)
  r = await fetch(`${PAINEL}/api/painel/whatsapp/comando`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ comando: 'pulso' }),
  })
  const bc = await r.json()
  // Com WHATSAPP_PONTE_URL apontando para este serviço, o painel executa na
  // hora (via=direto); sem ela, deixa na fila e o serviço pega no próximo ciclo.
  const esperaDireto = process.env.ESPERA_DIRETO === '1'
  ok(r.ok && bc.via === (esperaDireto ? 'direto' : 'fila'), `comando da tela foi ${esperaDireto ? 'direto ao serviço' : 'para a fila'} (via=${bc.via})`)
  await espera(2500)
  ok(new RegExp(`comando "pulso" \\((${esperaDireto ? 'direto' : 'fila'})\\)`).test(registro), `serviço executou o comando (${esperaDireto ? 'direto' : 'fila'})`)
  r = await fetch(`${PAINEL}/api/painel/whatsapp/comando`, { headers: { authorization: `Bearer ${TOKEN}` } })
  const vazio = await r.json()
  ok(vazio.comando === null, 'fila esvaziada depois de consumir')

  // 6. reconectar pela fila dispara nova tentativa de conexão
  const antes = (registro.match(/conectando|conexão encerrada/g) ?? []).length
  await fetch(`${PAINEL}/api/painel/whatsapp/comando`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ comando: 'reconectar' }),
  })
  await espera(3500)
  ok(/comando "reconectar" \((fila|direto)\)/.test(registro), 'serviço recebeu "reconectar"')
  const depois = (registro.match(/conectando|conexão encerrada/g) ?? []).length
  ok(depois >= antes, 'reconexão disparou nova tentativa')
} catch (err) {
  ok(false, `exceção no teste: ${err.message}`)
} finally {
  matar()
}

if (falhas) {
  console.log('\n--- registro do serviço ---\n' + registro.slice(-3000))
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo OK')
process.exit(falhas ? 1 : 0)
