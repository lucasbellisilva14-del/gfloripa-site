// Senhas dos corretores: PBKDF2-SHA256 via Web Crypto (sem dependência nova).
// Formato guardado: pbkdf2$<iterações>$<salt base64url>$<hash base64url>.
// Nunca guardamos a senha em texto; o gestor define e o painel só compara.

const ITERACOES = 120_000
const TAMANHO_HASH = 32

export const SENHA_MINIMA = 6

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derivar(senha: string, salt: Uint8Array<ArrayBuffer>, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iteracoes }, chave, TAMANHO_HASH * 8)
  return new Uint8Array(bits)
}

export function validarForcaSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  if (senha.length > 200) return 'Senha longa demais.'
  if (senha.trim() !== senha) return 'A senha não pode começar nem terminar com espaço.'
  return null
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
  const hash = await derivar(senha, salt, ITERACOES)
  return `pbkdf2$${ITERACOES}$${b64url(salt)}$${b64url(hash)}`
}

export async function verificarSenha(senha: string, guardado: string | null | undefined): Promise<boolean> {
  if (!guardado) return false
  const partes = guardado.split('$')
  if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false
  const iteracoes = Number(partes[1])
  if (!Number.isFinite(iteracoes) || iteracoes < 1000) return false
  try {
    const esperado = deB64url(partes[3])
    const calculado = await derivar(senha, deB64url(partes[2]), iteracoes)
    if (esperado.length !== calculado.length) return false
    let diff = 0
    for (let i = 0; i < esperado.length; i++) diff |= esperado[i] ^ calculado[i]
    return diff === 0
  } catch {
    return false
  }
}

// Senha temporária legível (sem letras que confundem), para o gestor passar
// ao corretor; ele troca depois em Configurações.
export function gerarSenhaTemporaria(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  let s = ''
  for (const b of bytes) s += alfabeto[b % alfabeto.length]
  return s
}
