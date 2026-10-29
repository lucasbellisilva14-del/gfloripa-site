import type { Estagio, Temperatura, TipoCliente } from '@/lib/painel/tipos'
import { ROTULO_ESTAGIO, ROTULO_TEMPERATURA, ROTULO_TIPO_CLIENTE } from '@/lib/painel/tipos'

export function TemperaturaBadge({ nivel, nota }: { nivel: Temperatura | null; nota?: number | null }) {
  if (!nivel) return <span className="p-badge p-badge-neutro">Sem análise</span>
  return (
    <span className={`p-badge p-badge-${nivel}`}>
      {ROTULO_TEMPERATURA[nivel]}
      {typeof nota === 'number' ? ` · ${nota}` : ''}
    </span>
  )
}

export function EstagioBadge({ estagio }: { estagio: Estagio | null }) {
  if (!estagio) return <span className="p-badge p-badge-neutro">Sem estágio</span>
  const classe = estagio === 'perdido' ? 'p-badge-danger' : estagio === 'fechamento' ? 'p-badge-ok' : 'p-badge-neutro'
  return <span className={`p-badge ${classe}`}>{ROTULO_ESTAGIO[estagio]}</span>
}

export function TipoBadge({ tipo }: { tipo: TipoCliente }) {
  return <span className="p-badge p-badge-neutro">{ROTULO_TIPO_CLIENTE[tipo]}</span>
}
