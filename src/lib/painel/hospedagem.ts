// O site e o painel saem do mesmo código, mas rodam em lugares diferentes:
// o site na Vercel (www) e o painel no Railway (painel.*). Esta função pura
// decide, pelo host e pelo caminho, se a requisição deve ser redirecionada.
// Sem PAINEL_HOST configurada, nada muda: tudo responde onde chegou.

export type DecisaoHost =
  | { acao: 'seguir' }
  | { acao: 'redirecionar'; destino: string; permanente: boolean }

const ehDoPainel = (caminho: string) => caminho === '/painel' || caminho.startsWith('/painel/') || caminho.startsWith('/api/painel')

function semPorta(host: string): string {
  return host.toLowerCase().split(':')[0]
}

export function decidirPorHost(e: { host: string | null; pathname: string; painelHost: string | null | undefined; search?: string }): DecisaoHost {
  const painelHost = (e.painelHost ?? '').trim().toLowerCase()
  if (!painelHost || !e.host) return { acao: 'seguir' }
  const host = semPorta(e.host)
  const noPainel = host === painelHost
  const busca = e.search ?? ''

  // no site: tudo que é do painel vai para o host do painel
  if (!noPainel && ehDoPainel(e.pathname)) {
    return { acao: 'redirecionar', destino: `https://${painelHost}${e.pathname}${busca}`, permanente: true }
  }
  // no host do painel: a raiz leva ao painel (o resto do site não é anunciado lá)
  if (noPainel && e.pathname === '/') {
    return { acao: 'redirecionar', destino: `https://${painelHost}/painel`, permanente: false }
  }
  return { acao: 'seguir' }
}
