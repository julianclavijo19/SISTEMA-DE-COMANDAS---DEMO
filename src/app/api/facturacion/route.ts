import { NextResponse } from 'next/server'
import { listBills, getNumberingRanges } from '@/lib/factus'

export const dynamic = 'force-dynamic'

// GET - Listar facturas electrónicas de Factus
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const identification = searchParams.get('identification') || undefined
    const number = searchParams.get('number') || undefined
    const status = searchParams.get('status') || undefined

    const data = await listBills(page, { identification, number, status })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error listando facturas electrónicas:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener facturas electrónicas' },
      { status: 500 }
    )
  }
}
