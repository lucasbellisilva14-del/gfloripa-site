// Testes do validador/normalizador da análise da I.A.
// Rodar: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANALISE_JSON_SCHEMA,
  ErroAnaliseInvalida,
  extrairJson,
  nivelPelaNota,
  normalizarDataLembrete,
  validarAnalise,
} from '../../src/lib/painel/analise-schema.ts'
import { ANALISE_DEMO } from '../../src/lib/painel/demo.ts'
import { detectarDataConversa } from '../../src/lib/painel/extrair-texto.ts'

test('o exemplo de demonstração passa na validação sem avisos', () => {
  const { analise, avisos } = validarAnalise(ANALISE_DEMO)
  assert.equal(avisos.length, 0)
  assert.equal(analise.temperatura.nivel, 'quente')
  assert.deepEqual(analise.fatos.imoveis_citados, ['C0412', 'C0398'])
  assert.equal(analise.lembretes.length, 3)
})

test('o esquema JSON exige todos os campos e proíbe propriedades extras', () => {
  assert.equal(ANALISE_JSON_SCHEMA.additionalProperties, false)
  assert.deepEqual([...ANALISE_JSON_SCHEMA.required].sort(), Object.keys(ANALISE_JSON_SCHEMA.properties).sort())
  // nenhum objeto do esquema pode ter additionalProperties diferente de false
  const visitar = (no) => {
    if (!no || typeof no !== 'object') return
    if (no.type === 'object') {
      assert.equal(no.additionalProperties, false)
      assert.deepEqual([...no.required].sort(), Object.keys(no.properties).sort())
    }
    for (const v of Object.values(no)) {
      if (Array.isArray(v)) v.forEach(visitar)
      else visitar(v)
    }
  }
  visitar(ANALISE_JSON_SCHEMA)
})

test('nível de temperatura é ajustado pela nota quando divergem', () => {
  const bruto = structuredClone(ANALISE_DEMO)
  bruto.temperatura.nivel = 'frio'
  bruto.temperatura.nota = 92
  const { analise, avisos } = validarAnalise(bruto)
  assert.equal(analise.temperatura.nivel, 'muito_quente')
  assert.ok(avisos.some((a) => a.includes('ajustado pela nota')))
})

test('notas fora de 0 a 100 são limitadas e strings numéricas aceitas', () => {
  const bruto = structuredClone(ANALISE_DEMO)
  bruto.temperatura.nota = '140'
  bruto.qualidade_atendimento.nota = -5
  const { analise } = validarAnalise(bruto)
  assert.equal(analise.temperatura.nota, 100)
  assert.equal(analise.qualidade_atendimento.nota, 0)
})

test('lembretes com data inválida são descartados com aviso; datas BR são convertidas', () => {
  const bruto = structuredClone(ANALISE_DEMO)
  bruto.lembretes = [
    { titulo: 'Ligar', data: 'sexta que vem', trecho: '', confianca: 'baixa' },
    { titulo: 'Visita', data: '01/11/2026 15:00', trecho: '', confianca: 'alta' },
    { titulo: 'Sem hora', data: '2026-11-05', trecho: '', confianca: 'media' },
  ]
  const { analise, avisos } = validarAnalise(bruto)
  assert.equal(analise.lembretes.length, 2)
  assert.equal(analise.lembretes[0].data, '2026-11-01T15:00')
  assert.equal(analise.lembretes[1].data, '2026-11-05')
  assert.ok(avisos.some((a) => a.includes('lembrete descartado')))
})

test('campos essenciais ausentes lançam ErroAnaliseInvalida', () => {
  assert.throws(() => validarAnalise({ resumo: 'x' }), ErroAnaliseInvalida)
  assert.throws(() => validarAnalise('texto'), ErroAnaliseInvalida)
  try {
    validarAnalise({})
  } catch (e) {
    assert.ok(e.problemas.includes('resumo ausente'))
    assert.ok(e.problemas.includes('temperatura ausente'))
  }
})

test('códigos de imóveis são normalizados em maiúsculas e sem repetição', () => {
  const bruto = structuredClone(ANALISE_DEMO)
  bruto.fatos.imoveis_citados = ['c0412', 'C0412', 't0624']
  const { analise } = validarAnalise(bruto)
  assert.deepEqual(analise.fatos.imoveis_citados, ['C0412', 'T0624'])
})

test('normalizarDataLembrete aceita vários formatos e rejeita datas impossíveis', () => {
  assert.equal(normalizarDataLembrete('2026-10-30T14:30:00'), '2026-10-30T14:30')
  assert.equal(normalizarDataLembrete('30/10/2026 14h30'), '2026-10-30T14:30')
  assert.equal(normalizarDataLembrete('2026-02-30'), null)
  assert.equal(normalizarDataLembrete(42), null)
})

test('nivelPelaNota segue as faixas do padrão de atendimento', () => {
  assert.equal(nivelPelaNota(0), 'frio')
  assert.equal(nivelPelaNota(29), 'frio')
  assert.equal(nivelPelaNota(30), 'morno')
  assert.equal(nivelPelaNota(60), 'quente')
  assert.equal(nivelPelaNota(85), 'muito_quente')
})

test('extrairJson tolera cercas de código e texto ao redor', () => {
  assert.deepEqual(extrairJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(extrairJson('Segue: {"a":{"b":2}} fim'), { a: { b: 2 } })
  assert.throws(() => extrairJson('nada aqui'), ErroAnaliseInvalida)
})

test('detectarDataConversa usa a última data brasileira do texto', () => {
  const texto = '24/10/2026 09:12 - A: oi\n25/10/2026 10:00 - B: tchau\n[26/10/26, 08:00] A: ok'
  assert.equal(detectarDataConversa(texto), '2026-10-26')
  assert.equal(detectarDataConversa('sem data'), null)
})
