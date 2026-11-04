// Testes da leitura de situação do serviço do WhatsApp: é o que decide o
// rótulo da tela, o aviso de serviço fora e a lista de verificações.
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

const base = { pontePronta: true, agoraMs: AGORA, origemPainel: 'https://www.nagamboaimoveis.com.br', saude: null }
const check = (r, chave) => r.verificacoes.find((v) => v.chave === chave)

test('sem token configurado, situação é nao_configurado e sem verificações', () => {
  const r = situacaoWhatsapp({ ...base, pontePronta: false, estado: null })
  assert.equal(r.situacao, 'nao_configurado')
  assert.equal(r.verificacoes.length, 0)
})

test('pulso recente e status conectado: conectado', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado() })
  assert.equal(r.situacao, 'conectado')
  assert.equal(check(r, 'servico').ok, true)
  assert.equal(check(r, 'pareado').ok, true)
})

test('o defeito original: status diz conectado mas o pulso parou', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ atualizado_em: iso(LIMITE_SEM_PULSO_MS + 1000) }) })
  assert.equal(r.situacao, 'sem_noticias')
  assert.equal(check(r, 'servico').ok, false)
  assert.match(check(r, 'servico').detalhe, /Último sinal há/)
  // pareado vira desconhecido: não dá para saber sem o serviço
  assert.equal(check(r, 'pareado').ok, null)
})

test('com domínio direto, a saúde em tempo real manda mais que o banco', () => {
  const foraDoAr = { alcancavel: false, conectado: false, numero: null, fila: 0, desde: null, versao: null, erro: 'sem resposta em 4 segundos' }
  const r1 = situacaoWhatsapp({ ...base, estado: estado(), saude: foraDoAr })
  assert.equal(r1.situacao, 'servico_fora')
  assert.match(check(r1, 'servico').detalhe, /sem resposta/)

  const vivoMasSemSessao = { alcancavel: true, conectado: false, numero: null, fila: 0, desde: iso(1000), versao: 'abc1234', erro: null }
  const r2 = situacaoWhatsapp({ ...base, estado: estado({ status: 'aguardando_qr' }), saude: vivoMasSemSessao })
  assert.equal(r2.situacao, 'aguardando_qr')
  assert.equal(check(r2, 'servico').ok, true)
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

test('tudo certo: cinco verificações verdes', () => {
  const r = situacaoWhatsapp({ ...base, estado: estado({ diagnostico: diag({ vistas: 12, aceitas: 10, enviadas: 10 }) }) })
  assert.deepEqual(r.verificacoes.map((v) => v.ok), [true, true, true, true, true])
})

test('nunca houve notícia: desconectado, sem acusar pulso perdido', () => {
  const r = situacaoWhatsapp({ ...base, estado: null })
  assert.equal(r.situacao, 'desconectado')
  assert.equal(r.msSemPulso, null)
  assert.equal(check(r, 'servico').ok, null)
})
