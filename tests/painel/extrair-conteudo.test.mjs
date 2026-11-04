// Testes da leitura de arquivos enviados na análise: zip, docx, imagens,
// mistura de formatos e os limites.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { lerZip, extrairTextoDocx } from '../../src/lib/painel/zip.ts'
import { extrairConteudo, tipoImagem, descreverOrigem, MAXIMO_ARQUIVOS } from '../../src/lib/painel/extrair-conteudo.ts'

// --- gerador de .zip só para os testes -------------------------------------
// Monta um zip de verdade (cabeçalho local, diretório central e registro
// final) para exercitar o leitor nos dois métodos de compressão.
function montarZip(entradas) {
  const locais = []
  const centrais = []
  let deslocamento = 0

  for (const { nome, conteudo, comprimir = false } of entradas) {
    const bruto = Buffer.from(conteudo, 'utf8')
    const dados = comprimir ? deflateRawSync(bruto) : bruto
    const metodo = comprimir ? 8 : 0
    const nomeBuf = Buffer.from(nome, 'utf8')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(metodo, 8)
    local.writeUInt32LE(0, 14) // crc, não verificado pelo leitor
    local.writeUInt32LE(dados.length, 18)
    local.writeUInt32LE(bruto.length, 22)
    local.writeUInt16LE(nomeBuf.length, 26)
    locais.push(local, nomeBuf, dados)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(metodo, 10)
    central.writeUInt32LE(dados.length, 20)
    central.writeUInt32LE(bruto.length, 24)
    central.writeUInt16LE(nomeBuf.length, 28)
    central.writeUInt32LE(deslocamento, 42)
    centrais.push(central, nomeBuf)

    deslocamento += local.length + nomeBuf.length + dados.length
  }

  const corpoLocal = Buffer.concat(locais)
  const corpoCentral = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0)
  fim.writeUInt16LE(entradas.length, 8)
  fim.writeUInt16LE(entradas.length, 10)
  fim.writeUInt32LE(corpoCentral.length, 12)
  fim.writeUInt32LE(corpoLocal.length, 16)
  return Buffer.concat([corpoLocal, corpoCentral, fim])
}

const arquivo = (nome, conteudo, tipo = '') =>
  new File([conteudo], nome, tipo ? { type: tipo } : undefined)

// --- zip -------------------------------------------------------------------

test('lê entradas armazenadas e comprimidas do zip', () => {
  const zip = montarZip([
    { nome: '_chat.txt', conteudo: 'linha um\nlinha dois' },
    { nome: 'IMG-001.jpg', conteudo: 'binario' },
    { nome: 'outro.txt', conteudo: 'texto comprimido '.repeat(40), comprimir: true },
  ])
  const txts = lerZip(zip, (n) => n.endsWith('.txt'))
  assert.equal(txts.length, 2)
  assert.equal(txts[0].nome, '_chat.txt')
  assert.equal(txts[0].conteudo.toString('utf8'), 'linha um\nlinha dois')
  assert.ok(txts[1].conteudo.toString('utf8').startsWith('texto comprimido'))
})

test('zip inválido dá erro claro', () => {
  assert.throws(() => lerZip(Buffer.from('nao sou um zip'), () => true), /zip inválido/i)
})

test('diretórios do zip são ignorados', () => {
  const zip = montarZip([
    { nome: 'pasta/', conteudo: '' },
    { nome: 'pasta/conversa.txt', conteudo: 'oi' },
  ])
  const achados = lerZip(zip, () => true)
  assert.equal(achados.length, 1)
  assert.equal(achados[0].nome, 'pasta/conversa.txt')
})

// --- docx ------------------------------------------------------------------

test('extrai texto de docx com parágrafos e entidades', () => {
  const xml =
    '<?xml version="1.0"?><w:document><w:body>' +
    '<w:p><w:r><w:t>Cliente quer casa &amp; terreno</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Valor ate R$ 800 mil</w:t></w:r></w:p>' +
    '</w:body></w:document>'
  const zip = montarZip([{ nome: 'word/document.xml', conteudo: xml, comprimir: true }])
  const texto = extrairTextoDocx(zip)
  assert.ok(texto.includes('Cliente quer casa & terreno'))
  assert.ok(texto.includes('Valor ate R$ 800 mil'))
  assert.ok(!texto.includes('<w:'))
})

test('docx sem document.xml dá erro', () => {
  const zip = montarZip([{ nome: 'outro.xml', conteudo: '<a/>' }])
  assert.throws(() => extrairTextoDocx(zip), /não encontrei texto/i)
})

// --- identificação de imagem -----------------------------------------------

test('reconhece imagem pelo tipo e pela extensão', () => {
  assert.equal(tipoImagem({ name: 'print.PNG', type: '' }), 'image/png')
  assert.equal(tipoImagem({ name: 'foto.jpeg', type: '' }), 'image/jpeg')
  assert.equal(tipoImagem({ name: 'sem-extensao', type: 'image/webp' }), 'image/webp')
  assert.equal(tipoImagem({ name: 'conversa.txt', type: 'text/plain' }), null)
})

// --- extração combinada ----------------------------------------------------

test('junta texto de vários arquivos e separa as imagens', async () => {
  const zip = montarZip([
    { nome: '_chat.txt', conteudo: 'conversa dentro do zip' },
    { nome: 'IMG.jpg', conteudo: 'nao deve aparecer' },
  ])
  const c = await extrairConteudo([
    arquivo('conversa.txt', 'primeira parte', 'text/plain'),
    arquivo('exportacao.zip', zip, 'application/zip'),
    arquivo('print.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png'),
  ])
  assert.ok(c.texto.includes('primeira parte'))
  assert.ok(c.texto.includes('conversa dentro do zip'))
  assert.ok(!c.texto.includes('nao deve aparecer'))
  assert.equal(c.imagens.length, 1)
  assert.equal(c.imagens[0].media_type, 'image/png')
  assert.equal(c.imagens[0].data, Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'))
  assert.deepEqual(c.nomes, ['conversa.txt', 'exportacao.zip', 'print.png'])
})

test('só prints: texto vazio e imagens preenchidas', async () => {
  const c = await extrairConteudo([
    arquivo('1.png', 'a', 'image/png'),
    arquivo('2.png', 'b', 'image/png'),
  ])
  assert.equal(c.texto, '')
  assert.equal(c.imagens.length, 2)
  assert.equal(descreverOrigem(c), 'prints')
  assert.ok(c.avisos.some((a) => a.includes('2 prints')))
})

test('formato não suportado é recusado com o nome do arquivo', async () => {
  await assert.rejects(() => extrairConteudo([arquivo('planilha.xlsx', 'x', 'application/vnd.ms-excel')]), /planilha\.xlsx/)
})

test('zip sem conversa dentro é recusado', async () => {
  const zip = montarZip([{ nome: 'IMG.jpg', conteudo: 'só mídia' }])
  await assert.rejects(() => extrairConteudo([arquivo('vazio.zip', zip, 'application/zip')]), /não achei arquivo de conversa/i)
})

test('limites de quantidade e de tamanho', async () => {
  const muitos = Array.from({ length: MAXIMO_ARQUIVOS + 1 }, (_, i) => arquivo(`p${i}.png`, 'x', 'image/png'))
  await assert.rejects(() => extrairConteudo(muitos), /no máximo/i)

  const gordo = arquivo('grande.png', Buffer.alloc(5 * 1024 * 1024), 'image/png')
  await assert.rejects(() => extrairConteudo([gordo]), /limite é 4 MB/i)
})

test('arquivo vazio é ignorado sem quebrar', async () => {
  const c = await extrairConteudo([arquivo('vazio.txt', ''), arquivo('bom.txt', 'conteudo')])
  assert.equal(c.texto, 'conteudo')
  assert.deepEqual(c.nomes, ['bom.txt'])
})
