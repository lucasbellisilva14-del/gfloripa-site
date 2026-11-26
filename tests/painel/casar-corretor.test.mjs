// Ligação de um corretor do painel ao cadastro dele na Jetimob.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { casarCorretorJetimob } from '../../src/lib/painel/casar-corretor.ts'

const lista = [
  { id: 10, nome: 'Márcia Ribeiro', email: 'marcia@nagamboa.com.br' },
  { id: 11, nome: 'Murilo Silva', email: null },
  { id: 12, nome: 'Juliana Costa', email: 'ju@nagamboa.com.br' },
  { id: 13, nome: 'Juliana Prates', email: null },
]

test('primeiro nome sem acento casa ("Marcia" com "Márcia Ribeiro")', () => {
  assert.equal(casarCorretorJetimob({ nome: 'Marcia' }, lista), 10)
  assert.equal(casarCorretorJetimob({ nome: 'MURILO' }, lista), 11)
})

test('nome completo e e-mail resolvem quando o primeiro nome é ambíguo', () => {
  assert.equal(casarCorretorJetimob({ nome: 'Juliana' }, lista), null, 'duas Julianas: não chuta')
  assert.equal(casarCorretorJetimob({ nome: 'juliana  prates' }, lista), 13)
  assert.equal(casarCorretorJetimob({ nome: 'Juliana', email: 'JU@nagamboa.com.br' }, lista), 12)
})

test('sem correspondência devolve null', () => {
  assert.equal(casarCorretorJetimob({ nome: 'Edmilson' }, lista), null)
  assert.equal(casarCorretorJetimob({ nome: 'Marcia' }, []), null)
})
