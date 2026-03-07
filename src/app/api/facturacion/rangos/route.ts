import { NextResponse } from 'next/server'
import { getNumberingRanges } from '@/lib/factus'

export const dynamic = 'force-dynamic'

// GET - Obtener rangos de numeración de Factus
export async function GET() {
  try {
    const ranges = await getNumberingRanges()
    
    // Filtrar solo rangos activos de facturas de venta
    const invoiceRanges = ranges.filter((r: any) => 
      r.is_active === 1 && r.document?.includes('Factura')
    )

    return NextResponse.json({ ranges, invoiceRanges })
  } catch (error: any) {
    console.error('Error obteniendo rangos de numeración:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener rangos de numeración' },
      { status: 500 }
    )
  }
}
