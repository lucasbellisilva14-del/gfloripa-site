// Testes da leitura de situação do serviço do WhatsApp: é o que decide o
// rótulo da tela, os avisos, se o QR aparece e a lista de verificações.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { situacaoWhatsapp, LIMITE_SEM_PULSO_MS } from '../../src/lib/painel/whatsapp-situacao.ts'

const AGORA = Date.parse('2026-11-04T12:00:00Z')
const iso = (msAtras) => new Date(AGORA - msAtras).toISOString()

const diag = (extra = {}) => ({
  versao: 'abc1234',
  desde: iso(10 * 60_000),
  vistas: 0,
  aceitas: 0,
  enviadas: 0,
  falhas_envio: 0,
  ultima_vista_em: null,
  ultimo_erro: null,
  painel_url: 'https://www.nagamboaimoveis.com.br',
  ...extra,
})

const estado = (extra = {}) => ({
  corretor_id: 1,
  status: 'conectado',
  qr: null,
  numero: '5548999990000',
  detalhe: null,
  comando: null,
  comando_em: null,
  diagnostico: diag(),
  atualizado_em: iso(10_000),
  ...extra,
})

const foraDoAr = { alcancavel: false, conectado: false, numero: null, fila: 0, desde: null, versao: null, erro: 'sem resposta em 3 segundos' }
const vivoSemSessao = { alcancavel: true, conectado: false, numero: null, fila: 0, desde: iso(1000), versao: 'abc1234', erro: null }
const vivoConectado = { ...vivoSemSessao, conectado: true, numero: '5548999990000' }

const base = { pontePronta: true, agoraMs: AGORA, origemPainel: 'https://www.nagamboaimoveis.com.br', saude: null, urlDireta: 'https://ponte.up.railway.app' }
const check = (r, chave) => r.verificacoes.find((v) => v.chave === chave)

test('sem token configurado, situação é nao_configurado e sem verificações', () => {
  const r = situacaoWhatsapp({ ...base, pontePronta: false, estado: null })
  assert.equal(r.situacao, 'nao_configurado')
  assert.equal(r.verificacoes.length, 0)
})

test('pulso recente e status conectado: conectado', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado() })
  assert.equal(r.situacao, 'conectado')
  assert.equal(r.servicoVivo, true)
  assert.equal(check(r, 'servico').ok, true)
  assert.equal(check(r, 'pareado').ok, true)
  assert.equal(check(r, 'direto'), undefined, 'sem endereço direto não há verificação dele')
})

test('status diz conectado mas o pulso parou: sem notícias', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ atualizado_em: iso(LIMITE_SEM_PULSO_MS + 1000) }) })
  assert.equal(r.situacao, 'sem_noticias')
  assert.equal(r.servicoVivo, false)
  assert.match(check(r, 'servico').detalhe, /Último sinal há/)
  assert.equal(check(r, 'pareado').ok, null)
})

test('O CASO DA TELA: endereço direto não responde, mas o pulso é recente e há QR gravado', () => {
  // Antes isto virava "Serviço fora do ar" e escondia o QR. O serviço estava
  // vivo pela fila e tinha acabado de gerar o código.
  const r = situacaoWhatsapp({ ...base, saude: foraDoAr, estado: estado({ status: 'aguardando_qr', qr: 'data:image/png;base64,x', numero: null }) })
  assert.equal(r.servicoVivo, true, 'pulso recente prova que está vivo')
  assert.equal(r.situacao, 'aguardando_qr')
  assert.equal(r.mostrarQr, true, 'o QR tem que aparecer')
  assert.equal(check(r, 'servico').ok, true)
  assert.equal(check(r, 'direto').ok, false)
  assert.match(check(r, 'direto').detalhe, /ponte\.up\.railway\.app/)
  assert.match(check(r, 'direto').detalhe, /pela fila/)
})

test('endereço direto não responde e o pulso também parou: aí sim, serviço fora do ar', () => {
  const r = situacaoWhatsapp({ ...base, saude: foraDoAr, estado: estado({ atualizado_em: iso(LIMITE_SEM_PULSO_MS + 1000) }) })
  assert.equal(r.situacao, 'servico_fora')
  assert.equal(r.servicoVivo, false)
  assert.equal(r.mostrarQr, false)
  assert.match(check(r, 'servico').detalhe, /Endereço direto: sem resposta/)
})

test('endereço direto responde: a saúde em tempo real manda', () => {
  const r1 = situacaoWhatsapp({ ...base, saude: vivoConectado, estado: estado({ atualizado_em: iso(LIMITE_SEM_PULSO_MS + 60_000) }) })
  assert.equal(r1.situacao, 'conectado', 'direto conectado vale mesmo com pulso velho')
  assert.equal(check(r1, 'direto').ok, true)

  const r2 = situacaoWhatsapp({ ...base, saude: vivoSemSessao, estado: estado({ status: 'aguardando_qr', qr: 'data:x' }) })
  assert.equal(r2.situacao, 'aguardando_qr')
  assert.equal(r2.mostrarQr, true)

  // banco atrasado dizendo conectado enquanto o serviço diz que não: conectando
  const r3 = situacaoWhatsapp({ ...base, saude: vivoSemSessao, estado: estado({ status: 'conectado' }) })
  assert.equal(r3.situacao, 'conectando')
})

test('QR gravado mas sem pulso recente nem direto: não mostra QR velho', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ status: 'aguardando_qr', qr: 'data:x', atualizado_em: iso(LIMITE_SEM_PULSO_MS + 1000) }) })
  assert.equal(r.situacao, 'sem_noticias')
  assert.equal(r.mostrarQr, false)
})

test('desconectado com serviço vivo: orienta a parear de novo', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ status: 'desconectado', numero: null }) })
  assert.equal(r.situacao, 'desconectado')
  assert.equal(r.servicoVivo, true)
  assert.match(check(r, 'pareado').detalhe, /Parear de novo/)
})

test('aponta para outro painel: verificação de endereço falha com instrução', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: diag({ painel_url: 'https://gfloripa-site.vercel.app' }) }) })
  assert.equal(check(r, 'endereco').ok, false)
  assert.match(check(r, 'endereco').detalhe, /Corrija PAINEL_URL/)
})

test('endereço bate ignorando barra final e protocolo', () => {
  const r = situacaoWhatsapp({ ...base, origemPainel: 'https://www.nagamboaimoveis.com.br/', estado: estado({ diagnostico: diag({ painel_url: 'http://www.nagamboaimoveis.com.br' }) }) })
  assert.equal(check(r, 'endereco').ok, true)
})

test('conectado há mais de 2 minutos sem ver mensagem: acusa', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: diag({ vistas: 0, desde: iso(5 * 60_000) }) }) })
  assert.equal(check(r, 'vendo').ok, false)
  assert.match(check(r, 'vendo').detalhe, /Mande um teste/)
})

test('conectado há pouco sem ver mensagem: ainda não dá para saber', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: diag({ vistas: 0, desde: iso(30_000) }) }) })
  assert.equal(check(r, 'vendo').ok, null)
})

test('vê mensagens mas falha ao entregar: entrega falha e mostra o erro', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: diag({ vistas: 5, aceitas: 5, enviadas: 0, falhas_envio: 3, ultimo_erro: 'painel entrada: 401' }) }) })
  assert.equal(check(r, 'vendo').ok, true)
  assert.equal(check(r, 'entregando').ok, false)
  assert.match(check(r, 'entregando').detalhe, /401/)
})

test('tudo certo, sem endereço direto: cinco verificações verdes', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: diag({ vistas: 12, aceitas: 10, enviadas: 10 }) }) })
  assert.deepEqual(r.verificacoes.map((v) => v.ok), [true, true, true, true, true])
})

test('tudo certo, com endereço direto: seis verificações verdes', () => {
  const r = situacaoWhatsapp({ ...base, saude: vivoConectado, estado: estado({ diagnostico: diag({ vistas: 12, aceitas: 10, enviadas: 10 }) }) })
  assert.equal(r.verificacoes.length, 6)
  assert.deepEqual(r.verificacoes.map((v) => v.ok), [true, true, true, true, true, true])
})

test('sem relógio (primeira renderização): confia no status e não acusa nada', () => {
  const r = situacaoWhatsapp({ ...base, agoraMs: 0, estado: estado({ status: 'aguardando_qr', qr: 'data:x' }) })
  assert.equal(r.situacao, 'aguardando_qr')
  assert.equal(r.mostrarQr, true)
  assert.equal(r.servicoVivo, null)
})

test('O CASO DO RAILWAY: direto responde sem versao, pulso sem diagnostico = build antigo', () => {
  const diretoAntigo = { alcancavel: true, conectado: true, numero: '554891363621', fila: 0, desde: null, versao: null, erro: null }
  const r = situacaoWhatsapp({ ...base, saude: diretoAntigo, estado: estado({ diagnostico: null }) })
  assert.equal(r.servicoVivo, true)
  assert.equal(r.situacao, 'conectado', 'continua pareado; o problema é o build')
  assert.equal(r.desatualizado, true)
  assert.equal(check(r, 'servico').ok, false)
  assert.match(check(r, 'servico').detalhe, /versão antiga/)
  assert.match(check(r, 'servico').detalhe, /Redeploy/)
})

test('sem endereco direto, pulso recente sem diagnostico tambem denuncia build antigo', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: null }) })
  assert.equal(r.desatualizado, true)
  assert.equal(check(r, 'servico').ok, false)
})

test('versao presente em qualquer fonte: nao e build antigo', () => {
  const r1 = situacaoWhatsapp({ ...base, saude: vivoConectado, estado: estado({ diagnostico: null }) })
  assert.equal(r1.desatualizado, false, 'direto com versao basta')
  const r2 = situacaoWhatsapp({ ...base, estado: estado() })
  assert.equal(r2.desatualizado, false, 'pulso com diagnostico basta')
  assert.match(check(r2, 'servico').detalhe, /versão abc1234/)
})

test('servico morto nao e classificado como build antigo', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: null, atualizado_em: iso(LIMITE_SEM_PULSO_MS + 1000) }) })
  assert.equal(r.desatualizado, false)
  assert.equal(r.situacao, 'sem_noticias')
})

test('nunca houve notícia: desconectado, sem acusar pulso perdido', () => {
  const r = situacaoWhatsapp({ ...base, estado: null })
  assert.equal(r.situacao, 'desconectado')
  assert.equal(r.msSemPulso, null)
  assert.equal(check(r, 'servico').ok, null)
})
