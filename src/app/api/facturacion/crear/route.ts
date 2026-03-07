import { NextResponse } from 'next/server'
import { createBill, mapPaymentMethod, CONSUMIDOR_FINAL, type FactusBillRequest, type FactusItem, type FactusCustomer } from '@/lib/factus'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST - Crear factura electrónica
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      order_id,
      customer,
      items,
      payment_method,
      numbering_range_id,
      observation,
    } = body

    // Si viene con order_id, obtener los datos de la orden
    let orderData: any = null
    let billItems: FactusItem[] = []

    if (order_id) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            unit_price,
            product:products (id, name)
          )
        `)
        .eq('id', order_id)
        .single()

      if (orderError || !order) {
        return NextResponse.json(
          { error: 'Orden no encontrada' },
          { status: 404 }
        )
      }

      orderData = order

      // Mapear items de la orden a formato Factus
      billItems = (order.order_items || []).map((item: any, index: number) => ({
        code_reference: item.product?.id?.substring(0, 20) || `PROD${index + 1}`,
        name: item.product?.name || `Producto ${index + 1}`,
        quantity: item.quantity,
        discount: 0,
        discount_rate: 0,
        price: parseFloat(item.unit_price).toFixed(2),
        tax_rate: '0.00', // Productos de restaurante generalmente excluidos de IVA o con tasa 0 en el sandbox
        unit_measure_id: '70', // Unidad
        standard_code_id: '1', // Estándar de adopción del contribuyente
        is_excluded: '0',
        tribute_id: '1', // IVA
        withholding_taxes: [],
      }))
    } else if (items && items.length > 0) {
      // Items proporcionados directamente
      billItems = items.map((item: any) => ({
        code_reference: item.code || `PROD-${Date.now()}`,
        name: item.name,
        quantity: item.quantity || 1,
        discount: item.discount || 0,
        discount_rate: item.discount_rate || 0,
        price: parseFloat(item.price).toFixed(2),
        tax_rate: item.tax_rate || '0.00',
        unit_measure_id: '70',
        standard_code_id: '1',
        is_excluded: '0',
        tribute_id: '1',
        withholding_taxes: [],
      }))
    } else {
      return NextResponse.json(
        { error: 'Se requiere order_id o items' },
        { status: 400 }
      )
    }

    // Construir datos del cliente
    let customerData: FactusCustomer
    if (customer && customer.identification) {
      customerData = {
        identification_document_id: customer.document_type_id || '3',
        identification: customer.identification,
        names: customer.names || customer.name || 'Consumidor Final',
        company: customer.company || '',
        trade_name: customer.trade_name || '',
        address: customer.address || 'Colombia',
        email: customer.email || '',
        phone: customer.phone || '',
        legal_organization_id: customer.legal_organization_id || '2',
        tribute_id: customer.tribute_id || '21',
        municipality_id: customer.municipality_id || '',
      }
    } else {
      customerData = { ...CONSUMIDOR_FINAL }
    }

    // Referencia única
    const referenceCode = order_id 
      ? `POS-${orderData?.order_number || Date.now()}-${Date.now().toString().slice(-6)}`
      : `POS-${Date.now()}`

    // Construir request
    const billRequest: FactusBillRequest = {
      numbering_range_id: numbering_range_id || 8, // ID del rango de numeración de factura
      reference_code: referenceCode,
      observation: observation || `Venta POS${orderData ? ` - Orden #${orderData.order_number}` : ''}`,
      payment_form: '1', // Contado
      payment_method: mapPaymentMethod(payment_method || 'cash'),
      customer: customerData,
      items: billItems,
    }

    // Crear factura en Factus
    const result = await createBill(billRequest)

    // Guardar referencia en la base de datos local
    if (result.data?.bill) {
      const bill = result.data.bill
      
      await supabase
        .from('electronic_invoices')
        .insert({
          factus_id: bill.id,
          bill_number: bill.number,
          reference_code: bill.reference_code,
          cufe: bill.cufe,
          status: bill.status,
          total: parseFloat(bill.total),
          customer_name: customerData.names,
          customer_identification: customerData.identification,
          customer_email: customerData.email || null,
          order_id: order_id || null,
          public_url: bill.public_url,
          qr_image: bill.qr_image,
          payment_method: billRequest.payment_method,
          factus_created_at: bill.created_at,
        })
        .select()
        .single()
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error creando factura electrónica:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear factura electrónica' },
      { status: 500 }
    )
  }
}
