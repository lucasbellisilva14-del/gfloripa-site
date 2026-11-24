// Site na Vercel, painel no Railway: o redirecionamento por host.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidirPorHost } from '../../src/lib/painel/hospedagem.ts'

const PAINEL = 'painel.nagamboaimoveis.com.br'

test('sem PAINEL_HOST nada muda', () => {
  assert.deepEqual(decidirPorHost({ host: 'www.nagamboaimoveis.com.br', pathname: '/painel', painelHost: '' }), { acao: 'seguir' })
  assert.deepEqual(decidirPorHost({ host: null, pathname: '/painel', painelHost: PAINEL }), { acao: 'seguir' })
})

test('no site, /painel e /api/painel vão para o host do painel, com a busca', () => {
  const r = decidirPorHost({ host: 'www.nagamboaimoveis.com.br', pathname: '/painel/clientes', painelHost: PAINEL, search: '?x=1' })
  assert.deepEqual(r, { acao: 'redirecionar', destino: `https://${PAINEL}/painel/clientes?x=1`, permanente: true })
  const api = decidirPorHost({ host: 'nagamboaimoveis.com.br', pathname: '/api/painel/login', painelHost: PAINEL })
  assert.equal(api.acao, 'redirecionar')
  const site = decidirPorHost({ host: 'www.nagamboaimoveis.com.br', pathname: '/imoveis', painelHost: PAINEL })
  assert.deepEqual(site, { acao: 'seguir' })
})

test('no host do painel, a raiz leva ao painel e o resto segue', () => {
  assert.deepEqual(decidirPorHost({ host: `${PAINEL}:443`, pathname: '/', painelHost: PAINEL }), { acao: 'redirecionar', destino: `https://${PAINEL}/painel`, permanente: false })
  assert.deepEqual(decidirPorHost({ host: PAINEL, pathname: '/painel/login', painelHost: PAINEL }), { acao: 'seguir' })
  assert.deepEqual(decidirPorHost({ host: PAINEL, pathname: '/api/painel/whatsapp/entrada', painelHost: PAINEL }), { acao: 'seguir' })
})

test('host é comparado sem diferença de maiúsculas', () => {
  assert.equal(decidirPorHost({ host: 'Painel.Nagamboaimoveis.com.br', pathname: '/painel', painelHost: PAINEL }).acao, 'seguir')
})
