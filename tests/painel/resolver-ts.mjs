import { pathToFileURL } from 'node:url'
import path from 'node:path'

const raizSrc = pathToFileURL(path.join(process.cwd(), 'src') + path.sep).href

export async function resolve(specifier, context, next) {
  let alvo = specifier
  if (alvo.startsWith('@/')) alvo = raizSrc + alvo.slice(2)
  const relativo = alvo.startsWith('.') || alvo.startsWith('file:')
  if (relativo && !/\.[cm]?[jt]sx?$/.test(alvo) && !alvo.endsWith('.json')) {
    try {
      return await next(`${alvo}.ts`, context)
    } catch {
      // cai para a resolução normal
    }
  }
  return next(alvo, context)
}
