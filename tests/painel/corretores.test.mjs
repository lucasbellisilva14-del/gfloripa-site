// Login individual por corretor: hash de senha, regras de autenticação e
// a camada de dados em memória (sem Supabase, modo demonstração).
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.PAINEL_SENHA // modo demo: senha mestra "demo"

const { gerarHashSenha, verificarSenha, gerarSenhaTemporaria, validarForcaSenha } = await import('../../src/lib/painel/senha.ts')
const { autenticar, conferirSenhaAtual } = await import('../../src/lib/painel/login.ts')
const { getDb } = await import('../../src/lib/painel/db.ts')

let db
before(async () => {
  db = await getDb()
})

test('hash de senha: confere a certa, recusa a errada e lixo', async () => {
  const h = await gerarHashSenha('segredo123')
  assert.match(h, /^pbkdf2\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/)
  assert.equal(await verificarSenha('segredo123', h), true)
  assert.equal(await verificarSenha('segredo124', h), false)
  assert.equal(await verificarSenha('segredo123', null), false)
  assert.equal(await verificarSenha('segredo123', 'qualquer-coisa'), false)
  const h2 = await gerarHashSenha('segredo123')
  assert.notEqual(h, h2, 'salt diferente a cada vez')
})

test('força da senha e senha temporária', () => {
  assert.ok(validarForcaSenha('12345'))
  assert.equal(validarForcaSenha('123456'), null)
  assert.ok(validarForcaSenha(' comespaco'))
  const t = gerarSenhaTemporaria()
  assert.equal(t.length, 10)
  assert.equal(validarForcaSenha(t), null)
})

test('equipe de demonstração vem com os cinco corretores', async () => {
  const lista = await db.listarCorretores()
  const usuarios = lista.map((c) => c.usuario).sort()
  assert.deepEqual(usuarios, ['edmilson', 'juliana', 'lucas', 'marcia', 'murilo'])
  const lucas = lista.find((c) => c.usuario === 'lucas')
  assert.equal(lucas.id, 77723, 'gestor padrão mantém o id dos dados antigos')
  assert.equal(lucas.papel, 'gestor')
  assert.ok(lista.every((c) => !('senha_hash' in c)), 'a lista nunca expõe o hash')
})

test('sem usuário, a senha mestra entra como gestor padrão', async () => {
  const r = await autenticar('', 'demo')
  assert.ok('corretor' in r, r.erro)
  assert.equal(r.corretor.id, 77723)
  assert.equal(r.corretor.papel, 'gestor')
  const errada = await autenticar('', 'outra')
  assert.ok('erro' in errada)
})

test('corretor sem senha definida: em demo entra com "demo"; com usuário errado não entra', async () => {
  const r = await autenticar('Murilo ', 'demo')
  assert.ok('corretor' in r, r.erro)
  assert.equal(r.corretor.usuario, 'murilo')
  assert.equal(r.corretor.papel, 'corretor')
  assert.notEqual(r.corretor.id, 77723, 'cada corretor tem o seu id')
  const x = await autenticar('ninguem', 'demo')
  assert.ok('erro' in x && x.status === 401)
})

test('senha definida pelo gestor vale, e "demo" deixa de valer para esse corretor', async () => {
  await db.atualizarCorretor(1003, { senha_hash: await gerarHashSenha('marcia2026') })
  const ok = await autenticar('marcia', 'marcia2026')
  assert.ok('corretor' in ok, ok.erro)
  assert.equal(ok.corretor.nome, 'Marcia')
  const demo = await autenticar('marcia', 'demo')
  assert.ok('erro' in demo && demo.status === 401)
  assert.equal(await conferirSenhaAtual(ok.corretor, 'marcia2026'), true)
  assert.equal(await conferirSenhaAtual(ok.corretor, 'errada'), false)
})

test('corretor desativado não entra; reativado volta a entrar', async () => {
  await db.atualizarCorretor(1004, { ativo: false })
  const r = await autenticar('juliana', 'demo')
  assert.ok('erro' in r && r.status === 403)
  assert.match(r.erro, /desativado/i)
  await db.atualizarCorretor(1004, { ativo: true })
  const r2 = await autenticar('juliana', 'demo')
  assert.ok('corretor' in r2)
})

test('criar corretor novo e impedir usuário repetido', async () => {
  const sufixo = String(Date.now()).slice(-5)
  const c = await db.criarCorretor({ usuario: `ana${sufixo}`, nome: 'Ana Souza', email: null, papel: 'corretor', jetimob_id: null, senha_hash: await gerarHashSenha('ana123456') })
  assert.ok(c.id >= 1001)
  assert.equal(c.tem_senha, true)
  const r = await autenticar(`ana${sufixo}`, 'ana123456')
  assert.ok('corretor' in r)
  const repetido = await db.obterCorretorPorUsuario(`ana${sufixo}`)
  assert.equal(repetido.id, c.id)
})
