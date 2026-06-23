export type PropertyPhoto = {
  url: string
  ordem: number
}

export type PropertyAddress = {
  bairro: string
  cidade: string
  estado: string
  latitude: number | null
  longitude: number | null
}

export type Property = {
  codigo: string
  titulo: string
  descricao: string
  preco: number
  tipo: string
  contrato: string
  area: number
  quartos: number
  banheiros: number
  vagas: number
  fotos: PropertyPhoto[]
  endereco: PropertyAddress
  destaque: boolean
}

export type PropertiesResponse = {
  imoveis: Property[]
  total: number
  pagina: number
  totalPaginas: number
}

const API_URL = process.env.JETIMOB_API_URL
const API_KEY = process.env.JETIMOB_API_KEY

function buildUrl(path: string): string {
  return `${API_URL}/${API_KEY}${path}`
}

export async function getProperties(params?: {
  page?: number
  pageSize?: number
  start?: number
}): Promise<PropertiesResponse> {
  const url = new URL(buildUrl('/imoveis'))
  url.searchParams.set('v', '6')
  if (params?.page !== undefined) url.searchParams.set('page', String(params.page))
  if (params?.pageSize !== undefined) url.searchParams.set('pageSize', String(params.pageSize))
  if (params?.start !== undefined) url.searchParams.set('start', String(params.start))

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`Jetimob API error: ${res.status}`)
  return res.json()
}

export async function getActivePropertyIds(): Promise<string[]> {
  const res = await fetch(buildUrl('/imoveis-ativos'), { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`Jetimob API error: ${res.status}`)
  return res.json()
}

export async function getProperty(code: string): Promise<Property | null> {
  const res = await fetch(buildUrl(`/imoveis/codigo/${code}`), { next: { revalidate: 60 } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Jetimob API error: ${res.status}`)
  return res.json()
}
