// Login por usuário e senha, com a tabela de corretores. Regras:
// - Sem usuário, vale a senha mestra (PAINEL_SENHA, ou "demo" em modo demo):
//   entra o gestor padrão. Mantém o login antigo funcionando e garante que o
//   gestor nunca fica trancado para fora, mesmo sem a tabela aplicada.
// - Com usuário, a senha é a definida pelo gestor (hash). O gestor padrão
//   também pode entrar com a senha mestra.
// - Em modo demo, corretor sem senha definida entra com "demo".
// Este módulo usa o banco: não pode ser importado pelo proxy.

import { corretorPadrao, modoDemoLogin, validarSenha } from './auth'
import { getDb } from './db'
import { verificarSenha } from './senha'
import type { Corretor, CorretorLogado } from './tipos'

export type ResultadoLogin = { corretor: CorretorLogado } | { erro: string; status: number }

export function paraLogado(c: Corretor): CorretorLogado {
  return { id: c.id, nome: c.nome, email: c.email ?? null, usuario: c.usuario, papel: c.papel, jetimob_id: c.jetimob_id ?? null }
}

export async function autenticar(usuarioBruto: string, senha: string): Promise<ResultadoLogin> {
  const usuario = usuarioBruto.trim().toLowerCase()
  const padrao = corretorPadrao()
  const db = await getDb()

  if (!usuario) {
    if (!validarSenha(senha)) return { erro: 'Senha incorreta', status: 401 }
    return { corretor: await completarPadrao(padrao) }
  }

  let linha: (Corretor & { senha_hash: string | null }) | null = null
  try {
    linha = await db.obterCorretorPorUsuario(usuario)
  } catch (err) {
    // tabela ainda não aplicada no Supabase: só o gestor padrão entra
    console.error('Painel: tabela corretores indisponível:', err)
  }

  if (!linha) {
    if (usuario === padrao.usuario && validarSenha(senha)) return { corretor: padrao }
    return { erro: 'Usuário ou senha incorretos', status: 401 }
  }
  if (!linha.ativo) return { erro: 'Acesso desativado. Fale com o gestor.', status: 403 }

  const ehPadrao = linha.id === padrao.id
  let ok = await verificarSenha(senha, linha.senha_hash)
  if (!ok && ehPadrao && validarSenha(senha)) ok = true
  if (!ok && !linha.senha_hash && modoDemoLogin() && senha === 'demo') ok = true
  if (!ok) {
    if (!linha.senha_hash && !ehPadrao) {
      return { erro: 'Sua senha ainda não foi definida. Peça ao gestor para criar em Configurações > Equipe.', status: 403 }
    }
    return { erro: 'Usuário ou senha incorretos', status: 401 }
  }
  return { corretor: paraLogado(linha) }
}

// O gestor padrão vem das variáveis de ambiente; se a tabela tiver a linha
// dele, o nome e o papel de lá prevalecem.
async function completarPadrao(padrao: CorretorLogado): Promise<CorretorLogado> {
  try {
    const db = await getDb()
    const linha = await db.obterCorretor(padrao.id)
    if (linha) return paraLogado(linha)
  } catch {
    // sem tabela: segue com o padrão
  }
  return padrao
}

// Confere a senha atual de quem está logado (para trocar a própria senha).
export async function conferirSenhaAtual(corretor: CorretorLogado, senhaAtual: string): Promise<boolean> {
  const padrao = corretorPadrao()
  if (corretor.id === padrao.id && validarSenha(senhaAtual)) return true
  try {
    const db = await getDb()
    const linha = corretor.usuario ? await db.obterCorretorPorUsuario(corretor.usuario) : null
    if (!linha) return false
    if (!linha.senha_hash) return modoDemoLogin() && senhaAtual === 'demo'
    return verificarSenha(senhaAtual, linha.senha_hash)
  } catch {
    return false
  }
}
