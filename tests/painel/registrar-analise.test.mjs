// Testes do fluxo "analisar e guardar" com o banco em memória e a I.A. em modo
// demonstração (sem ANTHROPIC_API_KEY). O que importa aqui é o vínculo com o
// cliente certo, o histórico montado para a I.A. e o respeito ao tipo fixado.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

delete process.env.ANTHROPIC_API_KEY // garante o modo demonstração
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY

const { analisarERegistrar, montarHistorico } = await import('../../src/lib/painel/registrar-analise.ts')
const { getDb } = await import('../../src/lib/painel/db.ts')

const corretor = { id: 880001, nome: 'Lucas', email: null }
const sufixo = () => String(Date.now() + Math.floor(Math.random() * 1000)).slice(-8)
const texto = 'Bom dia! Vi a casa C0412 na Gamboa. Temos 600 mil de entrada e financiamos o resto. Dá pra visitar domingo?'

let db
before(async () => {
  db = await getDb()
})

test('mesma pessoa, duas análises: um cliente só, duas conversas, duas análises', async () => {
  const telefone = `48 9${sufixo()}`
  const r1 = await analisarERegistrar({ corretor, texto, dataConversa: '2026-11-04', clienteNome: 'Charles', clienteTelefone: telefone, origem: 'colado' })
  const r2 = await analisarERegistrar({ corretor, texto: 'E aí, conseguiu ver o valor?', dataConversa: '2026-11-05', clienteTelefone: `(48) 9${telefone.split('9')[1]}`, origem: 'WhatsApp' })
  assert.equal(r1.cliente.id, r2.cliente.id, 'telefone em formato diferente ainda casa')
  assert.equal(r1.comHistorico, false, 'primeira análise não tem histórico')
  assert.equal(r2.comHistorico, true, 'segunda análise recebe o histórico')
  const conversas = await db.listarConversasDoCliente(r1.cliente.id)
  const analises = await db.listarAnalisesDoCliente(r1.cliente.id)
  assert.equal(conversas.length, 2)
  assert.equal(analises.length, 2)
})

test('chat vinculado (clienteExistenteId) sempre cai na mesma ficha', async () => {
  const r1 = await analisarERegistrar({ corretor, texto, dataConversa: '2026-11-04', clienteNome: `Pessoa ${sufixo()}`, origem: 'colado' })
  const r2 = await analisarERegistrar({ corretor, texto: 'oi', dataConversa: '2026-11-05', clienteExistenteId: r1.cliente.id, origem: 'WhatsApp' })
  assert.equal(r2.cliente.id, r1.cliente.id)
  assert.equal(r2.comHistorico, true)
})

test('tipo fixado manualmente não é sobrescrito pela análise', async () => {
  const telefone = `48 9${sufixo()}`
  const r1 = await analisarERegistrar({ corretor, texto, dataConversa: '2026-11-04', clienteTelefone: telefone, origem: 'colado' })
  // a demonstração devolve tipo_cliente = comprador; fixamos outro à mão
  await db.atualizarCliente(r1.cliente.id, { tipo: 'proprietario', tipo_origem: 'manual' })
  const r2 = await analisarERegistrar({ corretor, texto: 'ainda tenho interesse', dataConversa: '2026-11-05', clienteTelefone: telefone, origem: 'WhatsApp' })
  assert.equal(r2.cliente.tipo, 'proprietario', 'manual vence a I.A.')
  assert.equal(r2.cliente.tipo_origem, 'manual')
})

test('tipo escolhido no formulário vira manual; sem escolha, a I.A. decide', async () => {
  const r1 = await analisarERegistrar({ corretor, texto, dataConversa: '2026-11-04', clienteNome: `Form ${sufixo()}`, tipoCliente: 'locatario', origem: 'colado' })
  assert.equal(r1.cliente.tipo, 'locatario')
  assert.equal(r1.cliente.tipo_origem, 'manual')

  const r2 = await analisarERegistrar({ corretor, texto, dataConversa: '2026-11-04', clienteNome: `Livre ${sufixo()}`, origem: 'colado' })
  assert.equal(r2.cliente.tipo, 'comprador', 'tipo veio da análise, não de palavra solta')
  assert.equal(r2.cliente.tipo_origem, 'ia')
})

test('nome igual com telefone diferente NÃO funde clientes', async () => {
  // a demonstração extrai sempre "Mariana Costa" da conversa; um cliente com
  // esse nome e outro telefone já existe nos dados de exemplo
  const telefone = `48 9${sufixo()}`
  const r = await analisarERegistrar({ corretor, texto, dataConversa: '2026-11-04', clienteTelefone: telefone, origem: 'colado' })
  const existente = await db.buscarClientePorNome('Mariana Costa', r.cliente.corretor_id)
  assert.ok(r.cliente.nome === 'Mariana Costa', 'o nome vem da I.A.')
  assert.notEqual(r.cliente.id, 'demo-cli-mariana', 'não pode cair na ficha da outra Mariana')
  if (existente && existente.id !== r.cliente.id) {
    assert.notEqual(existente.telefone, r.cliente.telefone)
  }
})

test('montarHistorico resume a última análise e inclui as conversas, mais recentes primeiro', async () => {
  const telefone = `48 9${sufixo()}`
  const nome = `Historico ${sufixo()}`
  const r1 = await analisarERegistrar({ corretor, texto: 'primeira conversa, dia 1', dataConversa: '2026-11-01', clienteNome: nome, clienteTelefone: telefone, origem: 'colado' })
  await analisarERegistrar({ corretor, texto: 'segunda conversa, dia 3', dataConversa: '2026-11-03', clienteTelefone: telefone, origem: 'WhatsApp' })
  const cliente = await db.obterCliente(r1.cliente.id)
  const conversas = await db.listarConversasDoCliente(cliente.id)
  const analises = await db.listarAnalisesDoCliente(cliente.id)
  const h = montarHistorico(cliente, conversas, analises)
  assert.ok(h)
  assert.equal(h.totalAnalises, 2)
  assert.match(h.avaliacaoAnterior, /Quente \(78\/100\)/)
  assert.ok(h.resumoAnterior.length > 20)
  assert.ok(h.fatosAnteriores.some((l) => l.startsWith('Orçamento')))
  assert.equal(h.conversasAnteriores.length, 2)
  assert.match(h.conversasAnteriores[0], /dia 3/, 'mais recente primeiro')
  assert.match(h.conversasAnteriores[1], /dia 1/)
})

test('histórico respeita o limite de caracteres mantendo o mais recente', async () => {
  const cliente = { id: 'x', tipo: 'comprador', tipo_origem: 'ia', resumo: null }
  const grande = 'a'.repeat(30_000)
  const conversas = [
    { data_conversa: '2026-11-01T12:00:00Z', origem: 'colado', texto: grande },
    { data_conversa: '2026-11-03T12:00:00Z', origem: 'WhatsApp', texto: grande },
  ]
  const h = montarHistorico(cliente, conversas, [])
  const total = h.conversasAnteriores.join('').length
  assert.ok(total <= 40_500, `ficou em ${total} caracteres`)
  assert.match(h.conversasAnteriores[0], /2026-11-03/, 'a mais recente entra inteira')
  assert.match(h.conversasAnteriores[1] ?? '', /trecho cortado/, 'a antiga é cortada')
})
