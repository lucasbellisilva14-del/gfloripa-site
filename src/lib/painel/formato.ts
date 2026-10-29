// Formatação de datas, valores e textos do painel (pt-BR, fuso de SC).

const FUSO = 'America/Sao_Paulo'

// Converte string ISO em Date. Strings sem fuso (ex.: "2026-10-30T14:30",
// vindas da I.A.) são interpretadas como hora local de Santa Catarina.
export function paraData(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const s = iso.trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T09:00:00-03:00`)
  const d = new Date(`${s}${s.length === 16 ? ':00' : ''}-03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function hojeIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function dataIsoLocal(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function formatarData(iso: string | null | undefined, comHora = true): string {
  const d = paraData(iso)
  if (!d) return 'sem data'
  const temHora = comHora && !/^\d{4}-\d{2}-\d{2}$/.test(iso!.trim())
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(temHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d)
}

export function formatarDataCurta(iso: string | null | undefined): string {
  const d = paraData(iso)
  if (!d) return 'sem data'
  const hoje = hojeIso()
  const dia = dataIsoLocal(d)
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(d)
  const temHora = !/^\d{4}-\d{2}-\d{2}$/.test(iso!.trim())
  if (dia === hoje) return temHora ? `hoje às ${hora}` : 'hoje'
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  if (dia === dataIsoLocal(amanha)) return temHora ? `amanhã às ${hora}` : 'amanhã'
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  if (dia === dataIsoLocal(ontem)) return 'ontem'
  const texto = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: 'short' }).format(d)
  return temHora ? `${texto} ${hora}` : texto
}

export function tempoRelativo(iso: string | null | undefined): string {
  const d = paraData(iso)
  if (!d) return 'nunca'
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`
}

export function classificarLembrete(iso: string): 'atrasado' | 'hoje' | 'futuro' {
  const d = paraData(iso)
  if (!d) return 'futuro'
  const dia = dataIsoLocal(d)
  const hoje = hojeIso()
  if (dia < hoje) return 'atrasado'
  if (dia === hoje) return 'hoje'
  return 'futuro'
}

export function formatarUsd(v: number): string {
  if (!v) return 'US$ 0,000'
  return `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 })}`
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
