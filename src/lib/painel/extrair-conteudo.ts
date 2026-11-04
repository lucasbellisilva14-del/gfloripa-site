// Leitura dos arquivos que o corretor envia na análise.
//
// Aceita, em qualquer combinação e vários de uma vez:
//   .txt e .md      texto puro, inclui a exportação de conversa do WhatsApp
//   .zip            exportação do WhatsApp com mídia; lemos os .txt de dentro
//   .pdf            PDF gerado por texto (ver extrair-texto.ts)
//   .docx           documento do Word
//   imagens         prints de conversa, lidos pela visão do Claude
//
// Imagens não viram texto aqui: seguem para a I.A. como imagem, e a própria
// análise devolve a transcrição do que leu.

import { extrairTextoPdf, decodificarTexto } from './extrair-texto'
import { extrairTextoDocx, lerZip } from './zip'

// A Vercel limita o corpo de uma função a 4,5 MB; ficamos abaixo disso com
// folga para os campos do formulário.
export const TAMANHO_MAXIMO_TOTAL = 4 * 1024 * 1024
export const MAXIMO_ARQUIVOS = 10

const TIPOS_IMAGEM: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export type ImagemEnviada = { media_type: string; data: string; nome: string }

export type ConteudoExtraido = {
  texto: string
  imagens: ImagemEnviada[]
  nomes: string[]
  avisos: string[]
}

export function tipoImagem(arquivo: { name: string; type: string }): string | null {
  const porTipo = Object.values(TIPOS_IMAGEM).find((t) => t === arquivo.type)
  if (porTipo) return porTipo
  const ext = arquivo.name.toLowerCase().split('.').pop() ?? ''
  return TIPOS_IMAGEM[ext] ?? null
}

export async function extrairConteudo(arquivos: File[]): Promise<ConteudoExtraido> {
  if (arquivos.length > MAXIMO_ARQUIVOS) {
    throw new Error(`Envie no máximo ${MAXIMO_ARQUIVOS} arquivos por análise.`)
  }
  const total = arquivos.reduce((s, a) => s + a.size, 0)
  if (total > TAMANHO_MAXIMO_TOTAL) {
    throw new Error(
      `Os arquivos somam ${(total / 1024 / 1024).toFixed(1)} MB e o limite é 4 MB. Envie menos prints de cada vez.`
    )
  }

  const textos: string[] = []
  const imagens: ImagemEnviada[] = []
  const nomes: string[] = []
  const avisos: string[] = []

  for (const arquivo of arquivos) {
    if (arquivo.size === 0) continue
    nomes.push(arquivo.name)
    const nome = arquivo.name.toLowerCase()
    const bytes = Buffer.from(await arquivo.arrayBuffer())

    const imagem = tipoImagem(arquivo)
    if (imagem) {
      imagens.push({ media_type: imagem, data: bytes.toString('base64'), nome: arquivo.name })
      continue
    }

    if (nome.endsWith('.zip') || arquivo.type === 'application/zip') {
      const dentro = lerZip(bytes, (n) => n.toLowerCase().endsWith('.txt') && !n.startsWith('__MACOSX/'))
      if (!dentro.length) {
        throw new Error(`Não achei arquivo de conversa dentro de ${arquivo.name}.`)
      }
      for (const entrada of dentro) textos.push(decodificarTexto(entrada.conteudo))
      avisos.push(`De ${arquivo.name} li ${dentro.length} arquivo(s) de conversa; as mídias foram ignoradas.`)
      continue
    }

    if (nome.endsWith('.docx')) {
      textos.push(extrairTextoDocx(bytes))
      continue
    }

    if (nome.endsWith('.pdf') || arquivo.type === 'application/pdf') {
      const texto = extrairTextoPdf(bytes)
      if (texto.trim().length < 20) {
        throw new Error(
          `Não consegui ler texto de ${arquivo.name}. Se for digitalizado, mande um print dele, que a I.A. lê a imagem.`
        )
      }
      textos.push(texto)
      avisos.push(`Texto extraído de ${arquivo.name} de forma simplificada; confira se a ordem das linhas faz sentido.`)
      continue
    }

    if (nome.endsWith('.txt') || nome.endsWith('.md') || arquivo.type.startsWith('text/') || !arquivo.type) {
      textos.push(decodificarTexto(bytes))
      continue
    }

    throw new Error(`Formato não suportado: ${arquivo.name}. Aceito texto, PDF, Word, zip do WhatsApp e prints.`)
  }

  if (imagens.length > 1) {
    avisos.push(`${imagens.length} prints enviados; a I.A. lê na ordem em que aparecem na lista.`)
  }

  return { texto: textos.join('\n\n').trim(), imagens, nomes, avisos }
}

// Rótulo curto da origem, para o histórico do cliente.
export function descreverOrigem(c: ConteudoExtraido): string {
  if (c.imagens.length && !c.texto) return c.imagens.length === 1 ? 'print' : 'prints'
  if (c.imagens.length) return 'arquivo e prints'
  return 'arquivo'
}
