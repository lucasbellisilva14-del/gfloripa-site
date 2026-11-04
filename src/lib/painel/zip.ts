// Leitor mínimo de arquivos .zip, só o necessário para o painel: a
// exportação de conversa do WhatsApp (que vem zipada quando inclui mídia) e
// o .docx, que é um zip com o texto dentro de word/document.xml.
//
// Sem dependência nova: o Node já traz o inflate. Suporta os dois métodos de
// compressão que aparecem na prática, 0 (armazenado) e 8 (deflate).

import { inflateRawSync } from 'node:zlib'

export type EntradaZip = { nome: string; conteudo: Buffer }

const ASSINATURA_FIM_CENTRAL = 0x06054b50
const ASSINATURA_CENTRAL = 0x02014b50
const TAMANHO_MAXIMO_DESCOMPACTADO = 20 * 1024 * 1024

// Devolve as entradas cujo nome passa no filtro. Diretórios são ignorados.
export function lerZip(bytes: Buffer, querido: (nome: string) => boolean): EntradaZip[] {
  const fim = acharFimDoCentral(bytes)
  if (fim === -1) throw new Error('Arquivo .zip inválido ou incompleto.')

  const totalEntradas = bytes.readUInt16LE(fim + 10)
  let posicao = bytes.readUInt32LE(fim + 16)
  const saida: EntradaZip[] = []
  let descompactado = 0

  for (let i = 0; i < totalEntradas; i++) {
    if (posicao + 46 > bytes.length) break
    if (bytes.readUInt32LE(posicao) !== ASSINATURA_CENTRAL) break

    const metodo = bytes.readUInt16LE(posicao + 10)
    const tamanhoComprimido = bytes.readUInt32LE(posicao + 20)
    const tamanhoOriginal = bytes.readUInt32LE(posicao + 24)
    const tamanhoNome = bytes.readUInt16LE(posicao + 28)
    const tamanhoExtra = bytes.readUInt16LE(posicao + 30)
    const tamanhoComentario = bytes.readUInt16LE(posicao + 32)
    const deslocamentoLocal = bytes.readUInt32LE(posicao + 42)
    const nome = bytes.subarray(posicao + 46, posicao + 46 + tamanhoNome).toString('utf8')

    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario

    if (nome.endsWith('/')) continue
    if (!querido(nome)) continue
    descompactado += tamanhoOriginal
    if (descompactado > TAMANHO_MAXIMO_DESCOMPACTADO) {
      throw new Error('Conteúdo do .zip grande demais. Envie só o arquivo de conversa.')
    }

    const conteudo = lerEntradaLocal(bytes, deslocamentoLocal, metodo, tamanhoComprimido)
    if (conteudo) saida.push({ nome, conteudo })
  }
  return saida
}

// O cabeçalho local repete nome e extra com tamanhos próprios, então os dele
// é que valem para achar onde os dados começam.
function lerEntradaLocal(bytes: Buffer, deslocamento: number, metodo: number, tamanhoComprimido: number): Buffer | null {
  if (deslocamento + 30 > bytes.length) return null
  const tamanhoNome = bytes.readUInt16LE(deslocamento + 26)
  const tamanhoExtra = bytes.readUInt16LE(deslocamento + 28)
  const inicio = deslocamento + 30 + tamanhoNome + tamanhoExtra
  const dados = bytes.subarray(inicio, inicio + tamanhoComprimido)
  if (!dados.length) return null
  if (metodo === 0) return Buffer.from(dados)
  if (metodo !== 8) return null
  try {
    return inflateRawSync(dados)
  } catch {
    return null
  }
}

// O registro final fica no fim do arquivo, depois de um comentário de até
// 64 KB; por isso a busca é de trás para frente.
function acharFimDoCentral(bytes: Buffer): number {
  const limite = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= limite; i--) {
    if (bytes.readUInt32LE(i) === ASSINATURA_FIM_CENTRAL) return i
  }
  return -1
}

// Texto de um .docx: word/document.xml sem as marcações, com quebra de linha
// a cada parágrafo. Serve para resumo de atendimento salvo no Word.
export function extrairTextoDocx(bytes: Buffer): string {
  const partes = lerZip(bytes, (nome) => nome === 'word/document.xml')
  if (!partes.length) throw new Error('Não encontrei texto neste .docx.')
  return partes[0].conteudo
    .toString('utf8')
    .replace(/<w:tab\b[^>]*\/?>/g, ' ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
