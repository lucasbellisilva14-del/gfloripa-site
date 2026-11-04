// Testes do adaptador em memória para a parte do WhatsApp. O ponto principal:
// enfileirar um comando não pode renovar o pulso do serviço (atualizado_em),
// senão um serviço morto pareceria vivo por 95 s depois de qualquer clique.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarDbMemoria } from '../../src/lib/painel/db-memoria.ts'

const CORRETOR = 990001 // id que não existe na demonstração, para começar sem estado

test('enfileirar comando não altera o pulso (atualizado_em) nem o status', async () => {
  const db = await criarDbMemoria()
  const antes = await db.salvarEstadoWhatsapp(CORRETOR, { status: 'conectado', numero: '5548999990000' })
  await new Promise((r) => setTimeout(r, 5))
  await db.definirComandoWhatsapp(CORRETOR, 'parear_novamente')
  const depois = await db.obterEstadoWhatsapp(CORRETOR)
  assert.equal(depois.atualizado_em, antes.atualizado_em, 'pulso não pode mudar por causa do comando')
  assert.equal(depois.status, 'conectado')
  assert.equal(depois.comando, 'parear_novamente')
  assert.ok(depois.comando_em)
})

test('sem linha de estado, o comando cria uma sem sinal de vida', async () => {
  const db = await criarDbMemoria()
  const outro = CORRETOR + 1
  assert.equal(await db.obterEstadoWhatsapp(outro), null)
  await db.definirComandoWhatsapp(outro, 'pulso')
  const e = await db.obterEstadoWhatsapp(outro)
  assert.equal(e.status, 'desconectado')
  assert.equal(e.comando, 'pulso')
  assert.ok(Date.now() - Date.parse(e.atualizado_em) > 24 * 60 * 60 * 1000, 'atualizado_em antigo: não conta como pulso')
})

test('consumir lê e limpa; segunda leitura volta vazia', async () => {
  const db = await criarDbMemoria()
  await db.definirComandoWhatsapp(CORRETOR, 'reconectar')
  assert.equal(await db.consumirComandoWhatsapp(CORRETOR), 'reconectar')
  assert.equal(await db.consumirComandoWhatsapp(CORRETOR), null)
  const e = await db.obterEstadoWhatsapp(CORRETOR)
  assert.equal(e.comando, null)
  assert.equal(e.comando_em, null)
})

test('o pulso (salvarEstado) preserva o comando pendente', async () => {
  const db = await criarDbMemoria()
  await db.definirComandoWhatsapp(CORRETOR, 'reconectar')
  await db.salvarEstadoWhatsapp(CORRETOR, { status: 'conectando' })
  const e = await db.obterEstadoWhatsapp(CORRETOR)
  assert.equal(e.comando, 'reconectar', 'pulso não apaga comando ainda não consumido')
  assert.equal(e.status, 'conectando')
})

test('mensagens novas por conversa: contador e reset na análise', async () => {
  const db = await criarDbMemoria()
  const chat = `55489${String(Date.now()).slice(-7)}@s.whatsapp.net`
  const msg = (i) => ({ wa_chat_id: chat, wa_id: `t${i}`, direcao: 'entrada', nome: 'Teste', autor: 'Teste', texto: `m${i}`, data: new Date().toISOString() })
  await db.registrarMensagensWhatsapp(CORRETOR, [msg(1), msg(2), msg(3)])
  let c = (await db.listarChatsWhatsapp(CORRETOR)).find((x) => x.wa_chat_id === chat)
  assert.equal(c.total_mensagens, 3)
  assert.equal(c.mensagens_analisadas, 0)
  await db.atualizarChatWhatsapp(c.id, { analisado_em: new Date().toISOString(), mensagens_analisadas: 3 })
  await db.registrarMensagensWhatsapp(CORRETOR, [msg(4)])
  c = await db.obterChatWhatsapp(c.id)
  assert.equal(c.total_mensagens - c.mensagens_analisadas, 1, 'uma nova desde a análise')
})
