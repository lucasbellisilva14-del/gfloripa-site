// Visão da equipe (painel do gestor) e relatório de demonstração, com o banco
// em memória e os dados de exemplo.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.ANTHROPIC_API_KEY

const { montarVisaoEquipe, frequencias } = await import('../../src/lib/painel/equipe.ts')
const { gerarRelatorioEquipe, montarEntradaRelatorio, validarRelatorio, relatorioDemo } = await import('../../src/lib/painel/relatorio-equipe.ts')
const { getDb } = await import('../../src/lib/painel/db.ts')

let db
before(async () => {
  db = await getDb()
  // um cliente do Murilo, para a equipe ter mais de um corretor com carteira
  await db.criarCliente({ corretor_id: 1001, nome: 'Cliente do Murilo', telefone: '48 99999 1234', origem: 'teste' })
})

test('frequencias agrupa frases iguais sem acento e ordena pelas mais repetidas', () => {
  const f = frequencias([['Perguntou o orçamento', 'Tom acolhedor'], ['perguntou o orcamento!'], ['Tom acolhedor']])
  assert.equal(f[0].vezes, 2)
  assert.equal(f.length, 2)
})

test('visão da equipe: um resumo por corretor, totais batem com a soma', async () => {
  const v = await montarVisaoEquipe(db)
  assert.ok(v.porCorretor.length >= 5, 'os cinco corretores aparecem mesmo sem carteira')
  const lucas = v.porCorretor.find((r) => r.corretor.id === 77723)
  const murilo = v.porCorretor.find((r) => r.corretor.id === 1001)
  assert.ok(lucas.clientes >= 3, 'dados de demonstração são do gestor padrão')
  assert.ok(murilo.clientes >= 1)
  assert.equal(v.totais.clientes, v.porCorretor.reduce((s, r) => s + r.clientes, 0))
  assert.equal(v.totais.analisesTotal, v.porCorretor.reduce((s, r) => s + r.analisesTotal, 0))
  assert.equal(Object.values(v.funil).reduce((a, b) => a + b, 0), v.clientes.filter((c) => c.estagio).length)
  assert.ok(typeof lucas.notaAtendimento === 'number', 'nota média do atendimento vem das análises')
  assert.equal(murilo.notaAtendimento, null, 'sem análises, sem nota')
  assert.ok(lucas.pontosFortes.length > 0)
  assert.equal(v.porCorretor[0].corretor.id, 77723, 'quem tem mais clientes vem primeiro')
  assert.ok(v.clientes.every((c) => c.corretor_nome), 'cada cliente sabe o nome do corretor')
  assert.ok(v.analises.every((a) => a.cliente_nome && a.corretor_nome))
  assert.ok(v.alertas.some((a) => a.tipo === 'sem_analise' && a.corretor === 'Murilo'), 'cliente sem análise gera alerta')
})

test('entrada do relatório cita cada corretor e as análises', async () => {
  const v = await montarVisaoEquipe(db)
  const { texto, analisesConsideradas } = montarEntradaRelatorio(v)
  for (const nome of ['Lucas', 'Murilo', 'Edmilson', 'Marcia', 'Juliana']) assert.ok(texto.includes(`### ${nome}`), nome)
  assert.ok(analisesConsideradas >= 1, 'os dados de demonstração têm uma análise')
  assert.ok(texto.includes('Faltou perguntar'))
})

test('relatório demo valida no mesmo formato da I.A. e é guardado', async () => {
  const v = await montarVisaoEquipe(db)
  const demo = validarRelatorio(relatorioDemo(v))
  assert.ok(demo.resumo_geral.length > 20)
  assert.equal(demo.por_corretor.length, v.porCorretor.length)
  const g = await gerarRelatorioEquipe(v)
  assert.equal(g.demo, true)
  assert.equal(g.custo_usd, 0)
  assert.ok(g.relatorio.por_corretor.find((p) => p.nome === 'Murilo').resumo.includes('Sem análises'))
})

test('validarRelatorio tolera campos faltando e limita notas', () => {
  const r = validarRelatorio({ resumo_geral: 'ok', nota_equipe: 140, pontos_fortes: ['a', '', 3], por_corretor: [{ corretor_id: '1001', nome: 'Murilo', nota: -5 }] })
  assert.equal(r.nota_equipe, 100)
  assert.deepEqual(r.pontos_fortes, ['a'])
  assert.equal(r.por_corretor[0].corretor_id, 1001)
  assert.equal(r.por_corretor[0].nota, 0)
  assert.throws(() => validarRelatorio({}), /resumo/)
})
