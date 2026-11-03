// Permite que os testes (node:test) importem os módulos TypeScript do painel
// direto do código-fonte, sem build: o Node 22 já remove tipos; aqui só
// resolvemos imports relativos sem extensão (./tipos -> ./tipos.ts) e o
// alias "@/" do projeto.
import { register } from 'node:module'

register('./resolver-ts.mjs', import.meta.url)
