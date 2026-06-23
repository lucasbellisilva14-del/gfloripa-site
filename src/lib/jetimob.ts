export type PropertyImage = {
  link: string
  link_thumb: string
  titulo: string
}

export type Property = {
  codigo: string
  titulo_anuncio: string
  observacoes: string
  contrato: string
  tipo: string
  subtipo: string
  dormitorios: number
  suites: number
  banheiros: number
  garagens: number
  area_total: number | null
  area_privativa: number | null
  area_util: number | null
  terreno_total: string | null
  medida: string
  valor_venda: number | null
  valor_locacao: number | null
  valor_temporada: number | null
  valor_venda_visivel: boolean
  valor_locacao_visivel: boolean
  destaque: string
  latitude: number | null
  longitude: number | null
  endereco_bairro: string
  endereco_cidade: string
  endereco_estado: string
  endereco_logradouro: string
  endereco_cep: string
  imagens: PropertyImage[]
  status: string
}

export type PropertiesResponse = {
  total: number
  page: number
  pageSize: number
  totalPages: number
  data: Property[]
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

export function formatPrice(value: number | null): string {
  if (!value) return 'Consulte'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function getMainImage(property: Property): string {
  return property.imagens?.[0]?.link_thumb || property.imagens?.[0]?.link || ''
}
