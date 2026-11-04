// Testes do nome das conversas do WhatsApp. O defeito que originou isto: a
// conversa era batizada pelo pushName da primeira mensagem capturada, e
// quando o corretor falava primeiro a conversa levava o nome DELE.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeDaConversa, prepararMensagem } from '../../servicos/whatsapp/filtros.mjs'
import { criarDbMemoria } from '../../src/lib/painel/db-memoria.ts'

const AGORA = Date.parse('2026-11-05T12:00:00Z')
const SEG = Math.floor(AGORA / 1000) - 60
const CORRETOR = 770001

const msg = (extra = {}) => ({
  key: { remoteJid: '5548999990000@s.whatsapp.net', id: `id-${Math.random()}`, fromMe: false, ...(extra.key ?? {}) },
  message: { conversation: extra.texto ?? 'oi' },
  messageTimestamp: SEG,
  pushName: extra.pushName ?? 'Charles',
})

test('nome da conversa: agenda vence; sem agenda, só pushName da outra pessoa', () => {
  assert.equal(nomeDaConversa(msg({ pushName: 'Charles' }), 'Charles Cliente'), 'Charles Cliente')
  assert.equal(nomeDaConversa(msg({ pushName: 'Charles' }), null), 'Charles')
  // mensagem minha: pushName é o MEU nome, não serve para batizar a conversa
  assert.equal(nomeDaConversa(msg({ key: { fromMe: true }, pushName: 'Lucas' }), null), null)
  assert.equal(nomeDaConversa(msg({ key: { fromMe: true }, pushName: 'Lucas' }), 'Charles Cliente'), 'Charles Cliente')
})

test('prepararMensagem: mensagem minha sai com nome nulo e autor nulo', () => {
  const r = prepararMensagem(msg({ key: { fromMe: true }, pushName: 'Lucas' }), { agora: AGORA })
  assert.equal(r.mensagem.nome, null)
  assert.equal(r.mensagem.autor, null)
  assert.equal(r.mensagem.direcao, 'saida')
  const r2 = prepararMensagem(msg({ key: { fromMe: true }, pushName: 'Lucas' }), { agora: AGORA, nomeContato: 'Charles' })
  assert.equal(r2.mensagem.nome, 'Charles', 'com agenda, a mensagem minha também carrega o nome do contato')
})

test('painel: conversa aberta por mensagem minha não leva o meu nome; a resposta do contato batiza', async () => {
  const db = await criarDbMemoria()
  const chat = `55489${String(Date.now()).slice(-7)}@s.whatsapp.net`
  const base = (i, extra) => ({ wa_chat_id: chat, wa_id: `n${i}-${Date.now()}`, texto: `m${i}`, data: new Date().toISOString(), autor: null, nome: null, ...extra })
  await db.registrarMensagensWhatsapp(CORRETOR, [base(1, { direcao: 'saida', nome: 'Lucas' })], { meuNome: 'Lucas' })
  let c = (await db.listarChatsWhatsapp(CORRETOR)).find((x) => x.wa_chat_id === chat)
  assert.equal(c.nome, null, 'sem nome até a outra pessoa escrever')
  await db.registrarMensagensWhatsapp(CORRETOR, [base(2, { direcao: 'entrada', nome: 'Charles', autor: 'Charles' })], { meuNome: 'Lucas' })
  c = await db.obterChatWhatsapp(c.id)
  assert.equal(c.nome, 'Charles')
})

test('painel: conversa já batizada com o meu nome é corrigida quando chega mensagem', async () => {
  const db = await criarDbMemoria()
  const chat = `55489${String(Date.now() + 1).slice(-7)}@s.whatsapp.net`
  const base = (i, extra) => ({ wa_chat_id: chat, wa_id: `c${i}-${Date.now()}`, texto: `m${i}`, data: new Date().toISOString(), autor: null, nome: null, ...extra })
  // versão antiga da ponte: batizou com o nome do corretor (sem meuNome conhecido)
  await db.registrarMensagensWhatsapp(CORRETOR, [base(1, { direcao: 'entrada', nome: 'Lucas' })])
  let c = (await db.listarChatsWhatsapp(CORRETOR)).find((x) => x.wa_chat_id === chat)
  assert.equal(c.nome, 'Lucas', 'estado herdado do defeito')
  // ponte nova informa meu nome: o nome errado cai e o da outra pessoa entra
  await db.registrarMensagensWhatsapp(CORRETOR, [base(2, { direcao: 'entrada', nome: 'Charles', autor: 'Charles' })], { meuNome: 'Lucas' })
  c = await db.obterChatWhatsapp(c.id)
  assert.equal(c.nome, 'Charles')
})

test('painel: agenda renomeia conversas existentes e nunca aplica o meu nome', async () => {
  const db = await criarDbMemoria()
  const chat = `55489${String(Date.now() + 2).slice(-7)}@s.whatsapp.net`
  await db.registrarMensagensWhatsapp(CORRETOR, [{ wa_chat_id: chat, wa_id: `a-${Date.now()}`, direcao: 'saida', texto: 'oi', data: new Date().toISOString(), autor: null, nome: null }], { meuNome: 'Lucas' })
  const n = await db.renomearChatsWhatsapp(CORRETOR, [{ wa_chat_id: chat, nome: 'Charles da Agenda' }, { wa_chat_id: chat, nome: 'Lucas' }, { wa_chat_id: 'inexistente@s.whatsapp.net', nome: 'X' }], 'Lucas')
  assert.equal(n, 1)
  const c = (await db.listarChatsWhatsapp(CORRETOR)).find((x) => x.wa_chat_id === chat)
  assert.equal(c.nome, 'Charles da Agenda')
})
