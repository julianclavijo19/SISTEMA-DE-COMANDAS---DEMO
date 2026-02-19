import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET - Obtener mesas con pedidos pendientes de cobro para cajero
export async function GET() {
  try {
    // Primero obtener todas las órdenes activas (no pagadas, no canceladas)
    const { data: activeOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        order_type,
        subtotal,
        tax,
        discount,
        total,
        created_at,
        table_id,
        waiter:users!waiter_id(id, name),
        items:order_items(
          id, 
          quantity, 
          unit_price,
          status,
          product:products(id, name)
        )
      `)
      .neq('status', 'PAID')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      throw ordersError
    }

    // Obtener todas las áreas y mesas
    const { data: areas, error: areasError } = await supabase
      .from('areas')
      .select(`
        id,
        name,
        tables (
          id,
          name,
          capacity,
          status,
          is_active
        )
      `)
      .eq('is_active', true)
      .order('name')

    if (areasError) throw areasError

    // Mapear órdenes a sus mesas
    const ordersByTable = new Map()
    activeOrders?.forEach(order => {
      if (order.table_id) {
        ordersByTable.set(order.table_id, order)
      }
    })

    // Construir respuesta con áreas y mesas, incluyendo órdenes activas
    // También sincronizar estado de mesas
    const areasWithOrders = await Promise.all((areas || []).map(async (area) => ({
      ...area,
      tables: await Promise.all((area.tables || [])
        .filter((t: any) => t.is_active)
        .map(async (table: any) => {
          const order = ordersByTable.get(table.id)
          
          // Determinar el estado real basado en si hay órdenes activas
          let effectiveStatus = table.status
          
          if (order && table.status !== 'OCCUPIED') {
            // Hay una orden activa pero la mesa no está marcada como ocupada
            effectiveStatus = 'OCCUPIED'
            await supabase
              .from('tables')
              .update({ status: 'OCCUPIED', updated_at: new Date().toISOString() })
              .eq('id', table.id)
          } else if (!order && table.status === 'OCCUPIED') {
            // No hay orden activa pero la mesa está marcada como ocupada -> liberarla
            effectiveStatus = 'FREE'
            await supabase
              .from('tables')
              .update({ status: 'FREE', updated_at: new Date().toISOString() })
              .eq('id', table.id)
          }
          
          return {
            ...table,
            status: effectiveStatus,
            current_order: order ? {
              id: order.id,
              order_number: order.order_number,
              status: order.status,
              subtotal: Number(order.subtotal),
              tax: Number(order.tax),
              discount: Number(order.discount || 0),
              total: Number(order.total),
              created_at: order.created_at,
              items_count: order.items?.length || 0,
              items: order.items
            } : null,
            waiter: order?.waiter || null
          }
        }))
    })))

    // Calcular estadísticas - separar órdenes de mesa y para llevar
    const allTables = areasWithOrders.flatMap(a => a.tables)
    const tableOrders = (activeOrders || []).filter(o => o.table_id != null)
    const takeawayOrdersList = (activeOrders || []).filter(o => o.table_id == null)
    
    const stats = {
      total_tables: allTables.length,
      available: allTables.filter(t => t.status === 'FREE' || t.status === 'AVAILABLE').length,
      occupied: allTables.filter(t => t.status === 'OCCUPIED').length,
      pending_orders: tableOrders.length,
      total_pending: tableOrders.reduce((sum, o) => sum + Number(o.total), 0),
      takeaway_orders: takeawayOrdersList.length,
      takeaway_total: takeawayOrdersList.reduce((sum, o) => sum + Number(o.total), 0)
    }

    return NextResponse.json({
      areas: areasWithOrders,
      stats,
      orders: activeOrders || []
    })
  } catch (error) {
    console.error('Error in cajero/mesas:', error)
    return NextResponse.json(
      { error: 'Error al obtener datos de mesas' },
      { status: 500 }
    )
  }
}
