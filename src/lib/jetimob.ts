import { unstable_cache } from 'next/cache'

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
  id_corretor: number | null
}

export type Corretor = {
  id: number
  nome: string
  creci: string
  cargo: string
  email: string
  telefone: string | null
  telefone_whatsapp: boolean | null
  telefone2: string | null
  telefone2_whatsapp: boolean | null
  avatar: string | null
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

// Versão enxuta do imóvel para listagens: só os campos que os cards e
// filtros usam, com apenas a primeira foto. A resposta completa da Jetimob
// (~5 MB) estoura o limite de 2 MB do data cache do Next; a enxuta cabe.
function slimProperty(p: Property): Property {
  return {
    ...p,
    observacoes: '',
    imagens: p.imagens?.length ? [p.imagens[0]] : [],
  }
}

async function fetchAllProperties(): Promise<Property[]> {
  const first = await getProperties({ page: 1, pageSize: 500 })
  const all = [...(first.data ?? [])]
  let page = first.page
  while (all.length < first.total && page < first.totalPages) {
    page += 1
    const next = await getProperties({ page, pageSize: 500 })
    if (!next.data?.length) break
    all.push(...next.data)
  }
  return all.map(slimProperty)
}

// Cache em memória (lambda quente / dev) por cima do data cache do Next.
let memCache: { data: Property[]; at: number } | null = null
const MEM_TTL_MS = 2 * 60 * 1000

const getAllPropertiesCached = unstable_cache(fetchAllProperties, ['jetimob-all-properties'], {
  revalidate: 120,
})

export async function getAllProperties(): Promise<Property[]> {
  if (memCache && Date.now() - memCache.at < MEM_TTL_MS) return memCache.data
  const data = await getAllPropertiesCached()
  memCache = { data, at: Date.now() }
  return data
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

export const getCorretores = unstable_cache(
  async (): Promise<Corretor[]> => {
    const res = await fetch(buildUrl('/corretores'))
    if (!res.ok) throw new Error(`Jetimob API error: ${res.status}`)
    return res.json()
  },
  ['jetimob-corretores'],
  { revalidate: 3600 }
)

export async function getCorretorById(id: number | null): Promise<Corretor | null> {
  if (!id) return null
  const corretores = await getCorretores()
  return corretores.find((c) => c.id === id) ?? null
}

// Número de WhatsApp do corretor (só dígitos, com DDI), ou null se não tiver.
export function getCorretorWhatsapp(c: Corretor | null): string | null {
  if (!c) return null
  if (c.telefone && c.telefone_whatsapp) return c.telefone.replace(/\D/g, '')
  if (c.telefone2 && c.telefone2_whatsapp) return c.telefone2.replace(/\D/g, '')
  return null
}

export type LeadInput = {
  full_name: string
  email: string
  phone: string
  message?: string
  property_code?: string
  responsible?: string
  subject?: string
  url?: string
  gclid?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

// Cria um lead no CRM Jetimob (POST /leads/{PUBLIC_KEY}, multipart/form-data).
export async function createLead(input: LeadInput): Promise<void> {
  const publicKey = process.env.JETIMOB_PUBLIC_KEY
  const privateKey = process.env.JETIMOB_PRIVATE_KEY
  if (!publicKey || !privateKey) throw new Error('Chaves de lead da Jetimob não configuradas')

  const form = new FormData()
  form.set('full_name', input.full_name)
  form.set('email', input.email)
  form.set('phone', input.phone)
  form.set('source', 'Site Nagamboa')
  if (input.message) form.set('message', input.message)
  if (input.property_code) form.set('property_code', input.property_code)
  if (input.responsible) form.set('responsible', input.responsible)
  if (input.subject) form.set('subject', input.subject)
  if (input.url) form.set('url', input.url)
  if (input.gclid) form.set('gclid', input.gclid)
  if (input.utm_source) form.set('utm_source', input.utm_source)
  if (input.utm_medium) form.set('utm_medium', input.utm_medium)
  if (input.utm_campaign) form.set('utm_campaign', input.utm_campaign)

  const res = await fetch(`https://api.jetimob.com/leads/${publicKey}`, {
    method: 'POST',
    headers: { 'Authorization-Key': privateKey },
    body: form,
  })
  if (!res.ok) throw new Error(`Jetimob lead error: ${res.status} ${await res.text().catch(() => '')}`)
}

export function formatPrice(value: number | null): string {
  if (!value) return 'Consulte'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function getMainImage(property: Property): string {
  return property.imagens?.[0]?.link_thumb || property.imagens?.[0]?.link || ''
}
