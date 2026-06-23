import { type NextRequest } from 'next/server'
import { getProperties } from '@/lib/jetimob'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = searchParams.get('page')
  const pageSize = searchParams.get('pageSize')
  const start = searchParams.get('start')

  try {
    const data = await getProperties({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      start: start ? Number(start) : undefined,
    })
    return Response.json(data)
  } catch (err) {
    return Response.json({ error: 'Erro ao buscar imóveis' }, { status: 500 })
  }
}
