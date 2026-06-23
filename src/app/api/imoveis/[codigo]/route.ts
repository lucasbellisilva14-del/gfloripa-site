import { getProperty } from '@/lib/jetimob'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params

  try {
    const property = await getProperty(codigo)
    if (!property) {
      return Response.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }
    return Response.json(property)
  } catch (err) {
    return Response.json({ error: 'Erro ao buscar imóvel' }, { status: 500 })
  }
}
