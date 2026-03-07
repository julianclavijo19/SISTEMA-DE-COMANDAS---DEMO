import { NextResponse } from 'next/server'
import { downloadBillPDF } from '@/lib/factus'

export const dynamic = 'force-dynamic'

// GET - Descargar PDF de una factura electrónica
export async function GET(
  request: Request,
  { params }: { params: { number: string } }
) {
  try {
    const pdfBase64 = await downloadBillPDF(params.number)
    
    if (!pdfBase64) {
      return NextResponse.json(
        { error: 'PDF no disponible' },
        { status: 404 }
      )
    }

    // Devolver base64 para que el frontend lo maneje
    return NextResponse.json({ pdf: pdfBase64, number: params.number })
  } catch (error: any) {
    console.error('Error descargando PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Error al descargar PDF' },
      { status: 500 }
    )
  }
}
