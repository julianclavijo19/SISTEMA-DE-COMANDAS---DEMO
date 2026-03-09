import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET - Obtener estadísticas del dashboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today'
    const specificDate = searchParams.get('date')

    // Calcular fechas en UTC teniendo en cuenta que Colombia es UTC-5
    // Medianoche en Colombia = 05:00 UTC del mismo día
    const COLOMBIA_OFFSET_HOURS = 5
    
    let startDate: Date
    let endDate: Date

    if (specificDate) {
      // Fecha específica: YYYY-MM-DD en Colombia
      const [year, month, day] = specificDate.split('-').map(Number)
      // Medianoche Colombia = 5 AM UTC
      startDate = new Date(Date.UTC(year, month - 1, day, COLOMBIA_OFFSET_HOURS, 0, 0, 0))
      // 23:59:59 Colombia = 04:59:59 UTC del día siguiente
      endDate = new Date(Date.UTC(year, month - 1, day + 1, COLOMBIA_OFFSET_HOURS - 1, 59, 59, 999))
    } else {
      // Obtener la fecha actual en Colombia
      const nowUTC = new Date()
      // Restar 5 horas para obtener hora Colombia
      const colombiaTime = new Date(nowUTC.getTime() - (COLOMBIA_OFFSET_HOURS * 60 * 60 * 1000))
      // Extraer fecha Colombia
      const year = colombiaTime.getUTCFullYear()
      const month = colombiaTime.getUTCMonth()
      const day = colombiaTime.getUTCDate()
      
      // Hoy en Colombia: desde 00:00 hasta 23:59:59
      const todayStartUTC = new Date(Date.UTC(year, month, day, COLOMBIA_OFFSET_HOURS, 0, 0, 0))
      const todayEndUTC = new Date(Date.UTC(year, month, day + 1, COLOMBIA_OFFSET_HOURS - 1, 59, 59, 999))

      if (period === 'today') {
        startDate = todayStartUTC
        endDate = todayEndUTC
      } else if (period === 'week') {
        startDate = new Date(todayStartUTC.getTime() - (7 * 24 * 60 * 60 * 1000))
        endDate = todayEndUTC
      } else if (period === 'month') {
        startDate = new Date(todayStartUTC.getTime() - (30 * 24 * 60 * 60 * 1000))
        endDate = todayEndUTC
      } else {
        startDate = todayStartUTC
        endDate = todayEndUTC
      }
    }

    const startDateISO = startDate.toISOString()
    const endDateISO = endDate.toISOString()

    // Obtener pagos del periodo (filtro por fecha en query para evitar límite 1000)
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, amount, method, created_at, order_id')
      .gte('created_at', startDateISO)
      .lte('created_at', endDateISO)
      .order('created_at', { ascending: false })

    if (paymentsError) {
      console.error('Payments Error:', paymentsError)
    }

    const paymentsList = payments || []

    // Calcular ventas desde pagos (incluye refunds negativos)
    const totalSalesFromPayments = paymentsList.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const cashSales = paymentsList.filter(p => p.method === 'CASH').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const cardSales = paymentsList.filter(p => p.method === 'CARD').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const transferSales = paymentsList.filter(p => p.method === 'TRANSFER').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const totalPaidOrders = paymentsList.filter(p => Number(p.amount || 0) > 0).length

    // Obtener órdenes del periodo
    const { data: allOrdersRaw } = await supabase
      .from('orders')
      .select('id, status, total, paid_at, created_at')
    
    const allOrders = allOrdersRaw?.filter(o => {
      const oDate = new Date(o.created_at)
      return oDate >= startDate && oDate <= endDate
    }) || []

    // Usar ventas de pagos como fuente de verdad
    const totalSales = totalSalesFromPayments
    const totalOrders = allOrders.length

    // Ventas diarias - siempre mostrar mínimo 7 días para el gráfico
    const dailySales: { date: string; total: number }[] = []
    const daysToShow = period === 'month' ? 30 : 7
    
    const nowUTC2 = new Date()
    const colombiaTime2 = new Date(nowUTC2.getTime() - (COLOMBIA_OFFSET_HOURS * 60 * 60 * 1000))
    const todayYear = colombiaTime2.getUTCFullYear()
    const todayMonth = colombiaTime2.getUTCMonth()
    const todayDay = colombiaTime2.getUTCDate()

    // Obtener pagos del rango del gráfico (puede ser más amplio que el periodo de KPIs)
    const chartStartDate = new Date(Date.UTC(todayYear, todayMonth, todayDay - (daysToShow - 1), COLOMBIA_OFFSET_HOURS, 0, 0, 0))
    let chartPayments = paymentsList
    if (chartStartDate < startDate) {
      // Necesitamos pagos adicionales para el gráfico
      const { data: extraPayments } = await supabase
        .from('payments')
        .select('id, amount, method, created_at, order_id')
        .gte('created_at', chartStartDate.toISOString())
        .lt('created_at', startDateISO)
        .order('created_at', { ascending: false })
      chartPayments = [...(extraPayments || []), ...paymentsList]
    }
    
    for (let i = daysToShow - 1; i >= 0; i--) {
      const targetDate = new Date(Date.UTC(todayYear, todayMonth, todayDay - i))
      const targetYear = targetDate.getUTCFullYear()
      const targetMonth = targetDate.getUTCMonth()
      const targetDay = targetDate.getUTCDate()
      
      const dayStartUTC = new Date(Date.UTC(targetYear, targetMonth, targetDay, COLOMBIA_OFFSET_HOURS, 0, 0, 0))
      const dayEndUTC = new Date(Date.UTC(targetYear, targetMonth, targetDay + 1, COLOMBIA_OFFSET_HOURS - 1, 59, 59, 999))
      
      const dayPayments = chartPayments.filter(p => {
        const pDate = new Date(p.created_at)
        return pDate >= dayStartUTC && pDate <= dayEndUTC
      })
      
      const dayTotal = dayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      
      // Formatear la fecha para mostrar (en Colombia)
      const displayDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, 12, 0, 0)) // mediodía para evitar issues
      dailySales.push({
        date: displayDate.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', timeZone: 'America/Bogota' }),
        total: dayTotal
      })
    }

    // Productos más vendidos
    const orderIdsWithPayments = [...new Set(paymentsList.map(p => p.order_id).filter(Boolean))]
    
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        quantity,
        product_id,
        product:products(name),
        order_id
      `)
      .in('order_id', orderIdsWithPayments.length > 0 ? orderIdsWithPayments : ['none'])

    const productSales: any = {}
    orderItems?.forEach((item: any) => {
      if (!productSales[item.product_id]) {
        productSales[item.product_id] = {
          productId: item.product_id,
          name: item.product?.name,
          quantity: 0,
        }
      }
      productSales[item.product_id].quantity += item.quantity
    })

    const topProducts = Object.values(productSales)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((p: any) => ({
        productId: p.productId,
        product: { name: p.name },
        _sum: { quantity: p.quantity }
      }))

    // Mesas activas
    const { count: activeTables } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'OCCUPIED')

    const { count: totalTables } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    return NextResponse.json({
      totalSales,
      totalOrders,
      totalPaidOrders,
      dailySales,
      salesByMethod: {
        cash: cashSales,
        card: cardSales,
        transfer: transferSales
      },
      topProducts,
      activeTables: activeTables || 0,
      totalTables: totalTables || 0,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}
