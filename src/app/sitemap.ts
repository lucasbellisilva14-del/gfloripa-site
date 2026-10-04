import type { MetadataRoute } from 'next'
import { getAllProperties, type Property } from '@/lib/jetimob'

const SITE_URL = 'https://www.nagamboaimoveis.com.br'

// Data de atualização vinda da Jetimob ("2026-09-29 18:15:36"); se não vier,
// usa a data do build.
function lastModified(property: Property): Date {
  if (property.data_atualizacao) {
    const parsed = new Date(property.data_atualizacao.replace(' ', 'T'))
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixas: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/imoveis`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/sobre`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  let properties: Property[] = []
  try {
    properties = await getAllProperties()
  } catch {
    properties = []
  }

  const imoveis: MetadataRoute.Sitemap = properties.map((p) => ({
    url: `${SITE_URL}/imovel/${p.codigo}`,
    lastModified: lastModified(p),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...fixas, ...imoveis]
}
