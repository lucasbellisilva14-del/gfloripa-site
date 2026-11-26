// Ligação de um corretor do painel ao cadastro dele na Jetimob. Função pura,
// separada de imoveis.ts para poder ser testada sem o Next.js.

const normal = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
const primeiroNome = (s: string | null | undefined) => normal(s).split(' ')[0] ?? ''

// Casa um corretor do painel com a lista da Jetimob: nome completo igual,
// depois e-mail igual, depois primeiro nome (só se houver um com esse nome).
// Sem acento e sem diferença de maiúsculas ("Marcia" casa com "Márcia").
export function casarCorretorJetimob(
  corretor: { nome: string; email?: string | null },
  lista: { id: number; nome: string | null; email?: string | null }[]
): number | null {
  const nome = normal(corretor.nome)
  const porNome = lista.filter((c) => normal(c.nome) === nome)
  if (porNome.length === 1) return porNome[0].id
  const email = normal(corretor.email)
  if (email) {
    const porEmail = lista.filter((c) => normal(c.email) === email)
    if (porEmail.length === 1) return porEmail[0].id
  }
  const primeiro = primeiroNome(corretor.nome)
  const porPrimeiro = primeiro ? lista.filter((c) => primeiroNome(c.nome) === primeiro) : []
  return porPrimeiro.length === 1 ? porPrimeiro[0].id : null
}
