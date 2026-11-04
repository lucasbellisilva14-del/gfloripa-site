// Testes das regras de captura da ponte do WhatsApp.
//
// O defeito que originou estes testes: a ponte só aceitava mensagens do tipo
// 'notify' e descartava 'append', que é como chegam as mensagens enviadas pelo
// próprio celular do corretor e as que ficaram na fila com o serviço fora do
// ar. Na prática, metade da conversa não entrava no painel.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  carimboParaMs,
  dentroDaJanela,
  ehConversaDePessoa,
  prepararMensagem,
  textoDaMensagem,
  tipoAceito,
} from '../../servicos/whatsapp/filtros.mjs'

const SEG = (iso) => Math.floor(Date.parse(iso) / 1000)
const AGORA = Date.parse('2026-11-04T12:00:00Z')

const mensagem = (extra = {}) => ({
  key: { remoteJid: '5548999990000@s.whatsapp.net', id: 'ABC123', fromMe: false, ...(extra.key ?? {}) },
  message: extra.message ?? { conversation: 'oi' },
  messageTimestamp: extra.messageTimestamp ?? SEG('2026-11-04T11:59:00Z'),
  pushName: extra.pushName ?? 'Mariana Costa',
})

test('aceita notify e append, recusa o resto', () => {
  assert.equal(tipoAceito('notify'), true)
  assert.equal(tipoAceito('append'), true)
  assert.equal(tipoAceito('prepend'), false)
  assert.equal(tipoAceito(undefined), false)
})

test('mensagem que você mesmo enviou do celular é capturada como saída', () => {
  const r = prepararMensagem(mensagem({ key: { fromMe: true } }), { agora: AGORA })
  assert.ok(r.mensagem, r.recusa)
  assert.equal(r.mensagem.direcao, 'saida')
  assert.equal(r.mensagem.autor, null)
})

test('mensagem para si mesmo entra como qualquer outra conversa', () => {
  const r = prepararMensagem(
    mensagem({ key: { remoteJid: '5548988887777@s.whatsapp.net', fromMe: true }, message: { conversation: 'oi' } }),
    { agora: AGORA }
  )
  assert.ok(r.mensagem, r.recusa)
  assert.equal(r.mensagem.texto, 'oi')
})

test('grupos, canais e transmissões ficam de fora', () => {
  assert.equal(ehConversaDePessoa('12036304@g.us'), false)
  assert.equal(ehConversaDePessoa('abc@newsletter'), false)
  assert.equal(ehConversaDePessoa('status@broadcast'), false)
  assert.equal(ehConversaDePessoa('5548999990000@s.whatsapp.net'), true)
  assert.equal(ehConversaDePessoa(''), false)
  assert.equal(ehConversaDePessoa(null), false)
})

test('formato novo de endereço continua passando', () => {
  // o WhatsApp vem migrando o endereçamento; recusamos pelo que sabemos ser
  // grupo ou canal, em vez de permitir só um sufixo conhecido
  assert.equal(ehConversaDePessoa('123456789@lid'), true)
})

test('extrai texto e descreve a mídia sem deixar buraco', () => {
  assert.equal(textoDaMensagem({ message: { conversation: 'bom dia' } }), 'bom dia')
  assert.equal(textoDaMensagem({ message: { extendedTextMessage: { text: 'com link' } } }), 'com link')
  assert.equal(textoDaMensagem({ message: { audioMessage: {} } }), '[áudio]')
  assert.equal(textoDaMensagem({ message: { imageMessage: { caption: 'a casa' } } }), '[foto] a casa')
  assert.equal(textoDaMensagem({ message: { imageMessage: {} } }), '[foto]')
  assert.equal(textoDaMensagem({ message: { documentMessage: { fileName: 'contrato.pdf' } } }), '[documento: contrato.pdf]')
  assert.equal(textoDaMensagem({ message: { reactionMessage: {} } }), null)
  assert.equal(textoDaMensagem({ message: { protocolMessage: {} } }), null)
  assert.equal(textoDaMensagem({}), null)
})

test('carimbo de tempo vira milissegundos', () => {
  assert.equal(carimboParaMs(1762257540), 1762257540000)
  assert.equal(carimboParaMs(0), null)
  assert.equal(carimboParaMs(undefined), null)
})

test('janela de dias segura o despejo de histórico ao conectar', () => {
  const ontem = Date.parse('2026-11-03T12:00:00Z')
  const mesPassado = Date.parse('2026-10-01T12:00:00Z')
  assert.equal(dentroDaJanela(ontem, 7, AGORA), true)
  assert.equal(dentroDaJanela(mesPassado, 7, AGORA), false)
  assert.equal(dentroDaJanela(null, 7, AGORA), true)
  // relógio à frente demais é sinal de carimbo errado
  assert.equal(dentroDaJanela(Date.parse('2026-12-01T00:00:00Z'), 7, AGORA), false)
})

test('mensagem antiga é recusada com o motivo', () => {
  const r = prepararMensagem(mensagem({ messageTimestamp: SEG('2026-09-01T10:00:00Z') }), { agora: AGORA })
  assert.equal(r.mensagem, undefined)
  assert.match(r.recusa, /janela/)
})

test('mensagem de grupo e sem texto são recusadas com o motivo', () => {
  const grupo = prepararMensagem(mensagem({ key: { remoteJid: '123@g.us' } }), { agora: AGORA })
  assert.match(grupo.recusa, /pessoa/)
  const vazia = prepararMensagem(mensagem({ message: { reactionMessage: {} } }), { agora: AGORA })
  assert.match(vazia.recusa, /sem texto/)
})

test('mensagem preparada tem o formato que a rota do painel espera', () => {
  const r = prepararMensagem(mensagem(), { agora: AGORA })
  assert.deepEqual(Object.keys(r.mensagem).sort(), ['autor', 'data', 'direcao', 'nome', 'texto', 'wa_chat_id', 'wa_id'])
  assert.equal(r.mensagem.direcao, 'entrada')
  assert.equal(r.mensagem.autor, 'Mariana Costa')
  assert.equal(r.mensagem.data, '2026-11-04T11:59:00.000Z')
})
