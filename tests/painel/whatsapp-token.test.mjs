// Um WhatsApp por corretor: o token da ponte identifica o dono das mensagens.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.PAINEL_WHATSAPP_TOKEN = 'token-da-variavel'
process.env.WHATSAPP_PONTE_URL = 'http://ponte-padrao.local/'

const { exigirTokenPonte, gerarTokenPonte, ponteDoCorretor } = await import('../../src/lib/painel/whatsapp-token.ts')
const { getDb } = await import('../../src/lib/painel/db.ts')

const req = (token) => new Request('http://painel.local/api/painel/whatsapp/entrada', { headers: token ? { authorization: `Bearer ${token}` } : {} })

let db
before(async () => {
  db = await getDb()
})

test('token da variável de ambiente continua valendo para o gestor padrão', async () => {
  const r = await exigirTokenPonte(req('token-da-variavel'))
  assert.ok('corretor' in r)
  assert.equal(r.corretor.id, 77723)
})

test('token gerado no painel identifica o corretor dono', async () => {
  const token = gerarTokenPonte()
  assert.match(token, /^[a-f0-9]{64}$/)
  await db.atualizarCorretor(1001, { whatsapp_token: token, whatsapp_ponte_url: 'https://ponte-murilo.up.railway.app/' })
  const r = await exigirTokenPonte(req(token))
  assert.ok('corretor' in r)
  assert.equal(r.corretor.id, 1001)
  assert.equal(r.corretor.nome, 'Murilo')
  const lista = await db.listarCorretores()
  const murilo = lista.find((c) => c.id === 1001)
  assert.equal(murilo.tem_token_whatsapp, true)
  assert.ok(!('whatsapp_token' in murilo), 'a lista nunca expõe o token')
  const ponte = await ponteDoCorretor({ id: 1001 })
  assert.equal(ponte.token, token)
  assert.equal(ponte.url, 'https://ponte-murilo.up.railway.app', 'endereço sem barra no fim')
})

test('token desconhecido, vazio ou de corretor desativado é recusado', async () => {
  let r = await exigirTokenPonte(req('a'.repeat(64)))
  assert.ok('erro' in r && r.erro.status === 401)
  r = await exigirTokenPonte(req(''))
  assert.ok('erro' in r && r.erro.status === 401)
  const token = gerarTokenPonte()
  await db.atualizarCorretor(1002, { whatsapp_token: token, ativo: false })
  r = await exigirTokenPonte(req(token))
  assert.ok('erro' in r && r.erro.status === 401, 'desativado não entra nem pela ponte')
  await db.atualizarCorretor(1002, { ativo: true })
})

test('gestor padrão sem valores próprios cai nas variáveis de ambiente', async () => {
  const ponte = await ponteDoCorretor({ id: 77723 })
  assert.equal(ponte.token, 'token-da-variavel')
  assert.equal(ponte.url, 'http://ponte-padrao.local')
  const semNada = await ponteDoCorretor({ id: 1004 })
  assert.equal(semNada.token, null)
  assert.equal(semNada.url, null)
})
