// Extração de texto dos arquivos aceitos na análise: .txt (inclui exportação
// do WhatsApp), .md e .pdf simples. O PDF é tratado sem biblioteca: inflamos
// os streams FlateDecode e lemos os operadores de texto (Tj/TJ). Funciona
// bem para PDFs gerados por texto (exportações, relatórios); PDFs escaneados
// ou com fontes com codificação exótica devem ser colados como texto.

import { inflateSync } from 'node:zlib'

export const TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024

export type ArquivoExtraido = { texto: string; aviso: string | null }

export async function extrairTexto(arquivo: File): Promise<ArquivoExtraido> {
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error('Arquivo maior que 2 MB. Cole o trecho relevante da conversa.')
  }
  const nome = arquivo.name.toLowerCase()
  const bytes = Buffer.from(await arquivo.arrayBuffer())

  if (nome.endsWith('.pdf') || arquivo.type === 'application/pdf') {
    const texto = extrairTextoPdf(bytes)
    if (texto.trim().length < 20) {
      throw new Error('Não consegui ler texto deste PDF. Se for digitalizado ou complexo, cole o texto da conversa.')
    }
    return { texto, aviso: 'Texto extraído de PDF de forma simplificada; confira se a ordem das linhas faz sentido.' }
  }

  if (nome.endsWith('.txt') || nome.endsWith('.md') || arquivo.type.startsWith('text/') || !arquivo.type) {
    return { texto: decodificarTexto(bytes), aviso: null }
  }

  throw new Error('Formato não suportado. Envie .txt, .md ou .pdf.')
}

function decodificarTexto(bytes: Buffer): string {
  // exportações do WhatsApp vêm em UTF-8 (às vezes com BOM); caímos para
  // latin1 se houver caracteres inválidos
  let texto = bytes.toString('utf8')
  if (texto.includes('�')) texto = bytes.toString('latin1')
  return texto.replace(/^﻿/, '').replace(/‎/g, '').replace(/\r\n?/g, '\n')
}

export function extrairTextoPdf(bytes: Buffer): string {
  // latin1 preserva um byte por caractere: os índices da string valem para o Buffer
  const bruto = bytes.toString('latin1')
  const partes: string[] = []
  const re = /stream\r?\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(bruto)) !== null) {
    const ini = m.index + m[0].length
    const fim = bruto.indexOf('endstream', ini)
    if (fim === -1) break
    let dados = bytes.subarray(ini, fim)
    // o dicionário do objeto (logo antes do stream) diz se há FlateDecode
    const cab = bruto.slice(Math.max(0, m.index - 400), m.index)
    if (/FlateDecode/.test(cab)) {
      try {
        dados = inflateSync(dados)
      } catch {
        try {
          dados = inflateSync(dados.subarray(0, dados.length - 1))
        } catch {
          re.lastIndex = fim
          continue
        }
      }
    }
    const conteudo = dados.toString('latin1')
    if (/\bT[Jj]\b/.test(conteudo)) partes.push(extrairOperadoresTexto(conteudo))
    re.lastIndex = fim
  }
  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Lê strings entre parênteses em operadores Tj / TJ e quebra linha em Td/TD/T*
function extrairOperadoresTexto(conteudo: string): string {
  let saida = ''
  const re = /\((?:\\.|[^\\)])*\)\s*Tj|\[((?:\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ|T\*|\bT[dD]\b|\bTm\b|'|"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(conteudo)) !== null) {
    const tok = m[0]
    if (tok.endsWith('Tj')) {
      saida += decodificarStringPdf(tok.slice(0, tok.lastIndexOf(')') + 1))
    } else if (tok.endsWith('TJ')) {
      const interno = m[1] ?? ''
      const strs = interno.match(/\((?:\\.|[^\\)])*\)/g) ?? []
      saida += strs.map(decodificarStringPdf).join('')
    } else {
      saida += '\n'
    }
  }
  return saida
}

function decodificarStringPdf(s: string): string {
  const corpo = s.slice(1, -1)
  return corpo.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, g: string) => {
    switch (g) {
      case 'n':
        return '\n'
      case 'r':
        return ''
      case 't':
        return ' '
      case 'b':
      case 'f':
        return ''
      case '(':
      case ')':
      case '\\':
        return g
      default:
        return String.fromCharCode(parseInt(g, 8))
    }
  })
}

// Procura a última data no formato brasileiro (exportação do WhatsApp) para
// sugerir a "data da conversa" quando o corretor não informa.
export function detectarDataConversa(texto: string): string | null {
  const re = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g
  let ultima: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    const d = Number(m[1])
    const me = Number(m[2])
    let a = Number(m[3])
    if (a < 100) a += 2000
    if (d < 1 || d > 31 || me < 1 || me > 12 || a < 2000 || a > 2100) continue
    ultima = `${a}-${String(me).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return ultima
}
