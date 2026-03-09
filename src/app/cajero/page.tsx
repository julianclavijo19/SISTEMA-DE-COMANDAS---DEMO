'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui'
import { formatCurrency, getTimeDifference } from '@/lib/utils'
import { 
  Users, Search, RefreshCw, Timer, DollarSign, 
  CreditCard, Banknote, X, Printer, CheckCircle,
  Clock, TrendingUp, Wallet, AlertCircle, ArrowRight,
  Play, Square, Receipt, ChevronRight, AlertTriangle,
  ShoppingBag, Truck, Edit2, RotateCcw, FileText, Loader2, ShoppingCart
} from 'lucide-react'
import toast from 'react-hot-toast'
import { printInvoice, type OrderData } from '@/lib/printer'

// Interfaces
interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  status: string
  product: { id: string; name: string }
}

interface Order {
  id: string
  order_number: number
  status: string
  subtotal: number
  tax: number
  discount: number
  total: number
  created_at: string
  items_count: number
  items: OrderItem[]
}

interface Table {
  id: string
  name: string
  capacity: number
  status: string
  current_order: Order | null
  waiter: { id: string; name: string } | null
}

interface Area {
  id: string
  name: string
  tables: Table[]
}

interface Shift {
  id: string
  user_id: string
  opening_amount: number
  closing_amount?: number
  expected_amount?: number
  difference?: number
  cash_sales: number
  card_sales: number
  transfer_sales: number
  total_sales: number
  total_refunds?: number
  total_orders: number
  status: string
  opened_at: string
  closed_at?: string
  notes?: string
}

interface Transaction {
  id: string
  amount: number
  method: string
  received_amount?: number
  change_amount?: number
  created_at: string
  order?: {
    id: string
    order_number: number
    table?: { name: string }
  }
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

// Takeaway/Delivery order interface
interface TakeawayOrder {
  id: string
  order_number: number
  type: string
  order_type: string
  status: string
  subtotal: number
  tax: number
  discount: number
  total: number
  created_at: string
  items: OrderItem[]
  waiter?: { id: string; name: string } | null
}

export default function CajeroPage() {
  const router = useRouter()
  
  // State
  const [user, setUser] = useState<User | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [takeawayOrders, setTakeawayOrders] = useState<TakeawayOrder[]>([])
  const [counterOrders, setCounterOrders] = useState<TakeawayOrder[]>([])
  const [stats, setStats] = useState({ 
    total_tables: 0, available: 0, occupied: 0, 
    pending_orders: 0, total_pending: 0,
    takeaway_orders: 0, takeaway_total: 0 
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Shift state
  const [shift, setShift] = useState<Shift | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [shiftLoading, setShiftLoading] = useState(true)
  
  // Modals
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  
  // Payment modal
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedTakeawayOrder, setSelectedTakeawayOrder] = useState<TakeawayOrder | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  
  // Discount state
  const [showDiscountOptions, setShowDiscountOptions] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [configuredDiscounts, setConfiguredDiscounts] = useState<Array<{id: string; name: string; discount_type: string; value: number}>>([])
  
  // Pending orders warning modal
  const [showPendingWarning, setShowPendingWarning] = useState(false)
  const [pendingOrders, setPendingOrders] = useState<Array<{orderNumber: number; tableName: string; total: number; type: string}>>([])

  // Factura Electrónica
  const [showFEModal, setShowFEModal] = useState(false)
  const [feProcessing, setFEProcessing] = useState(false)
  const [feAsConsumidorFinal, setFEAsConsumidorFinal] = useState(true)
  const [feCustomer, setFECustomer] = useState({
    document_type_id: '3', identification: '', names: '', email: '', phone: '', address: '', company: '', legal_organization_id: '2', tribute_id: '21',
  })

  // Get user from cookie
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }

    const sessionCookie = getCookie('session')
    if (sessionCookie) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(sessionCookie))
        setUser(sessionData)
      } catch (e) {
        console.error('Error parsing session:', e)
      }
    }
  }, [])

  // Fetch shift data
  const fetchShift = useCallback(async () => {
    try {
      const res = await fetch('/api/cajero/turno')
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift)
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('Error fetching shift:', error)
    } finally {
      setShiftLoading(false)
    }
  }, [])

  // Fetch discounts data
  const fetchDiscounts = useCallback(async () => {
    try {
      const res = await fetch('/api/cajero/descuentos/configurar')
      if (res.ok) {
        const data = await res.json()
        setConfiguredDiscounts((data.discounts || []).filter((d: any) => d.is_active))
      }
    } catch (error) {
      console.error('Error fetching discounts:', error)
    }
  }, [])

  // Fetch tables data
  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/cajero/mesas')
      if (res.ok) {
        const data = await res.json()
        setAreas(data.areas || [])
        setStats(data.stats || { 
          total_tables: 0, available: 0, occupied: 0, 
          pending_orders: 0, total_pending: 0,
          takeaway_orders: 0, takeaway_total: 0 
        })
        
        // Split orders: counter (COUNTER type) and para llevar (TAKEOUT/DELIVERY)
        const counter = (data.orders || []).filter((o: any) => 
          !o.table_id && (o.order_type === 'COUNTER' || o.type === 'COUNTER')
        )
        const takeaway = (data.orders || []).filter((o: any) => 
          !o.table_id && o.order_type !== 'COUNTER' && o.type !== 'COUNTER'
        )
        setCounterOrders(counter)
        setTakeawayOrders(takeaway)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShift()
    fetchTables()
    fetchDiscounts()
    const interval = setInterval(() => {
      fetchTables()
      fetchShift()
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchShift, fetchTables, fetchDiscounts])

  // Open shift
  const handleOpenShift = async () => {
    if (!user) {
      toast.error('Usuario no identificado')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch('/api/cajero/turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_amount: parseFloat(openingAmount) || 0,
          user_id: user.id
        })
      })

      if (res.ok) {
        const data = await res.json()
        setShift(data.shift)
        setShowOpenShift(false)
        setOpeningAmount('')
        toast.success('Turno abierto exitosamente')
        fetchShift()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Error al abrir turno')
      }
    } catch (error) {
      toast.error('Error al abrir turno')
    } finally {
      setProcessing(false)
    }
  }

  // Close shift
  const handleCloseShift = async (forceClose = false) => {
    if (!shift) return

    setProcessing(true)
    try {
      const res = await fetch('/api/cajero/turno', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: shift.id,
          closing_amount: parseFloat(closingAmount) || 0,
          notes: closingNotes,
          force_close: forceClose
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        setShift(null)
        setTransactions([])
        setShowCloseShift(false)
        setShowPendingWarning(false)
        setClosingAmount('')
        setClosingNotes('')
        toast.success(`Turno cerrado. Diferencia: ${formatCurrency(data.summary.difference)}`)
        fetchShift()
      } else {
        // Verificar si el error es por pedidos sin cobrar
        if (data.code === 'PENDING_ORDERS') {
          setPendingOrders(data.pendingOrders || [])
          setShowPendingWarning(true)
          setShowCloseShift(false)
        } else {
          toast.error(data.error || 'Error al cerrar turno')
        }
      }
    } catch (error) {
      toast.error('Error al cerrar turno')
    } finally {
      setProcessing(false)
    }
  }

  // Calculate discount
  const calculateDiscount = () => {
    const order = selectedTable?.current_order || selectedTakeawayOrder
    if (!order) return 0
    const orderTotal = order.total
    if (discountType === 'percent') {
      return orderTotal * (discountAmount / 100)
    }
    return Math.min(discountAmount, orderTotal)
  }

  // Calculate final total after discount
  const calculateFinalTotal = () => {
    const order = selectedTable?.current_order || selectedTakeawayOrder
    if (!order) return 0
    return order.total - calculateDiscount()
  }

  // Calculate change
  const calculateChange = () => {
    const order = selectedTable?.current_order || selectedTakeawayOrder
    if (!order || paymentMethod !== 'CASH') return 0
    const received = parseFloat(receivedAmount) || 0
    const finalTotal = calculateFinalTotal()
    return Math.max(0, received - finalTotal)
  }

  // Handle payment
  const handlePayment = async () => {
    const order = selectedTable?.current_order || selectedTakeawayOrder
    if (!order) return
    
    const finalTotal = calculateFinalTotal()
    const discountValue = calculateDiscount()
    
    // Normal payment mode
    const received = parseFloat(receivedAmount) || 0
    
    if (paymentMethod === 'CASH' && received < finalTotal) {
      toast.error('Monto recibido insuficiente')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentMethod,
          received_amount: paymentMethod === 'CASH' ? received : finalTotal,
          change_amount: calculateChange(),
          tip: 0,
          discount: discountValue
        })
      })

      if (res.ok) {
        const changeMsg = paymentMethod === 'CASH' && calculateChange() > 0 
          ? ` Cambio: ${formatCurrency(calculateChange())}` 
          : ''
        
        // openCashDrawer se ejecuta desde el API (print_queue) → cash-drawer-script
        toast.success(`Pago procesado exitosamente.${changeMsg}`)
        closePaymentModal()
        fetchTables()
        fetchShift()
        handlePrintInvoice().catch(console.error)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Error al procesar pago')
      }
    } catch (error) {
      toast.error('Error al procesar pago')
    } finally {
      setProcessing(false)
    }
  }

  // Print invoice
  const handlePrintInvoice = async () => {
    const order = selectedTable?.current_order || selectedTakeawayOrder
    if (!order) return

    const orderData: OrderData = {
      orderNumber: order.order_number,
      tableName: selectedTable?.name || 
        (selectedTakeawayOrder?.order_type === 'COUNTER' 
          ? 'Mostrador' 
          : (selectedTakeawayOrder?.order_type === 'DELIVERY' 
            ? 'Domicilio' 
            : 'Para Llevar')),
      waiterName: selectedTable?.waiter?.name || selectedTakeawayOrder?.waiter?.name || '',
      createdAt: order.created_at,
      items: order.items?.map(item => ({
        quantity: item.quantity,
        product: { name: item.product.name },
        unitPrice: item.unit_price
      })) || [],
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      discount: order.discount,
      paymentMethod: paymentMethod,
      receivedAmount: paymentMethod === 'CASH' ? parseFloat(receivedAmount) || order.total : order.total,
      changeAmount: calculateChange()
    }

    try {
      await printInvoice(orderData)
      toast.success('Factura impresa')
    } catch (error) {
      console.error('Error al imprimir:', error)
      toast.error('Error al imprimir factura')
    }
  }

  const closePaymentModal = () => {
    setSelectedTable(null)
    setSelectedTakeawayOrder(null)
    setPaymentMethod('CASH')
    setReceivedAmount('')
    setDiscountAmount(0)
    setDiscountType('percent')
    setShowDiscountOptions(false)
    setShowFEModal(false)
    setFEAsConsumidorFinal(true)
    setFECustomer({ document_type_id: '3', identification: '', names: '', email: '', phone: '', address: '', company: '', legal_organization_id: '2', tribute_id: '21' })
  }

  // Emitir factura electrónica
  const handleEmitirFE = async () => {
    const order = selectedTable?.current_order || selectedTakeawayOrder
    if (!order) return
    setFEProcessing(true)
    try {
      const body: any = { order_id: order.id, payment_method: paymentMethod.toLowerCase() }
      if (!feAsConsumidorFinal) {
        if (!feCustomer.identification || !feCustomer.names) {
          toast.error('Ingrese identificación y nombre del cliente')
          setFEProcessing(false)
          return
        }
        body.customer = feCustomer
      }
      const res = await fetch('/api/facturacion/crear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await res.json()
      if (res.ok) {
        toast.success(`Factura electrónica ${result.data?.bill?.number || ''} emitida`)
        setShowFEModal(false)
      } else {
        toast.error(result.error || 'Error al emitir factura electrónica')
      }
    } catch (error) {
      toast.error('Error al emitir factura electrónica')
    } finally {
      setFEProcessing(false)
    }
  }

  // Enter to confirm payment when modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModalOpen = selectedTable !== null || selectedTakeawayOrder !== null
      if (!isModalOpen || e.key !== 'Enter' || processing) return

      const target = e.target as HTMLElement

      // Cash mode: only trigger when amount input is focused and sufficient
      if (paymentMethod === 'CASH' && target.tagName === 'INPUT') {
        const received = parseFloat(receivedAmount) || 0
        if (received >= calculateFinalTotal()) {
          e.preventDefault()
          handlePayment()
        }
        return
      }

      // Card/Transfer: trigger from anywhere except inputs
      if (paymentMethod !== 'CASH' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        handlePayment()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTable, selectedTakeawayOrder, paymentMethod, receivedAmount, processing])

  // Filter tables
  const filteredAreas = areas.map(area => ({
    ...area,
    tables: area.tables.filter(table => {
      if (searchQuery && !table.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (filter === 'pending' && !table.current_order) {
        return false
      }
      return true
    })
  })).filter(area => area.tables.length > 0)

  // Loading state
  if (loading || shiftLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // No shift open - show open shift screen
  if (!shift) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay turno abierto</h2>
            <p className="text-gray-500 mb-6">Abre un turno para comenzar a cobrar</p>
            <button
              onClick={() => setShowOpenShift(true)}
              className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
            >
              <Play className="h-5 w-5" />
              Abrir Turno
            </button>
          </CardContent>
        </Card>

        {/* Modal abrir turno */}
        {showOpenShift && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Abrir Turno de Caja</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Monto de Apertura</label>
                  <input
                    type="number"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Efectivo inicial en caja</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowOpenShift(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleOpenShift}
                    disabled={processing}
                    className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {processing ? 'Abriendo...' : 'Abrir Turno'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con info del turno */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Caja</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500">
              Turno abierto desde {new Date(shift.opened_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => { fetchTables(); fetchShift(); }}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={() => setShowCloseShift(true)}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium flex items-center gap-2 hover:bg-red-100 transition-colors"
          >
            <Square className="h-4 w-4" />
            Cerrar Turno
          </button>
        </div>
      </div>

      {/* Stats del turno */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Banknote className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Efectivo</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(shift.cash_sales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Tarjeta</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(shift.card_sales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Transferencia</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(shift.transfer_sales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Ventas</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(shift.total_sales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(shift.total_refunds || 0) > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <RotateCcw className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-red-500">Devoluciones</p>
                  <p className="text-lg font-semibold text-red-600">-{formatCurrency(shift.total_refunds || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Receipt className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Transacciones</p>
                <p className="text-lg font-semibold text-gray-900">{shift.total_orders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Por cobrar */}
      <Card className="bg-gradient-to-r from-gray-900 to-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-gray-300 text-sm">Cuentas por cobrar</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(stats.total_pending + stats.takeaway_total)}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">{stats.pending_orders + takeawayOrders.length + counterOrders.length}</p>
              <p className="text-gray-300 text-sm">pedidos pendientes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Counter (Mostrador) Orders Section */}
      {counterOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Por Mostrador ({counterOrders.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {counterOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedTakeawayOrder(order)}
                className="cursor-pointer"
              >
                <Card className="transition-all hover:shadow-md ring-2 ring-amber-400">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-2">
                      <ShoppingCart className="h-4 w-4 text-amber-600" />
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        Mostrador
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">#{order.order_number}</h3>
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{order.items?.length || 0} items</span>
                        <span className="font-bold text-gray-900">{formatCurrency(order.total)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Timer className="h-3 w-3" />
                        <span>{getTimeDifference(order.created_at)}</span>
                      </div>
                      <button className="w-full mt-2 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 hover:bg-amber-700">
                        Cobrar <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Takeaway/Delivery Orders Section */}
      {takeawayOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Para Llevar ({takeawayOrders.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {takeawayOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedTakeawayOrder(order)}
                className="cursor-pointer"
              >
                <Card className="transition-all hover:shadow-md ring-2 ring-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-2">
                      {order.order_type === 'DELIVERY' ? (
                        <Truck className="h-4 w-4 text-blue-600" />
                      ) : (
                        <ShoppingBag className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {order.order_type === 'DELIVERY' ? 'Domicilio' : 'P/Llevar'}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900">#{order.order_number}</h3>

                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{order.items?.length || 0} items</span>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(order.total)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Timer className="h-3 w-3" />
                        <span>{getTimeDifference(order.created_at)}</span>
                      </div>
                      <button className="w-full mt-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 hover:bg-blue-700">
                        Cobrar <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables grid */}
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <Users className="h-4 w-4" />
        Mesas
      </h2>

      {filteredAreas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-900 font-medium">No hay cuentas pendientes</p>
            <p className="text-gray-500 text-sm mt-1">Todas las mesas están al día</p>
          </CardContent>
        </Card>
      ) : (
        filteredAreas.map((area) => (
          <div key={area.id}>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              {area.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {area.tables.map((table) => {
                const hasOrder = table.current_order !== null

                return (
                  <div
                    key={table.id}
                    onClick={() => hasOrder && setSelectedTable(table)}
                    className={hasOrder ? 'cursor-pointer' : 'cursor-default'}
                  >
                    <Card className={`transition-all ${hasOrder ? 'hover:shadow-md ring-2 ring-gray-900' : 'opacity-50'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{table.name}</h3>
                          <div className={`w-2.5 h-2.5 rounded-full ${hasOrder ? 'bg-gray-900' : 'bg-green-500'}`} />
                        </div>
                        
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                          <Users className="h-4 w-4" />
                          <span>{table.capacity}</span>
                        </div>

                        {hasOrder && table.current_order ? (
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                            {table.waiter && (
                              <p className="text-xs text-gray-500 truncate">
                                {table.waiter.name}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">#{table.current_order.order_number}</span>
                              <span className="font-bold text-gray-900">
                                {formatCurrency(table.current_order.total)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Timer className="h-3 w-3" />
                              <span>{getTimeDifference(table.current_order.created_at)}</span>
                            </div>
                            <button className="w-full mt-2 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 hover:bg-gray-800">
                              Cobrar <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <span className="text-xs text-green-600">Disponible</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Payment Modal */}
      {selectedTable && selectedTable.current_order && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedTable.name}</h2>
                <p className="text-sm text-gray-500">
                  Orden #{selectedTable.current_order.order_number}
                  {selectedTable.waiter && ` • ${selectedTable.waiter.name}`}
                </p>
              </div>
              <button 
                onClick={closePaymentModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Items */}
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {selectedTable.current_order.items?.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.quantity}x {item.product.name}
                      </p>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(selectedTable.current_order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA (8%)</span>
                  <span>{formatCurrency(selectedTable.current_order.tax)}</span>
                </div>
                {(selectedTable.current_order.discount > 0 || calculateDiscount() > 0) && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento</span>
                    <span>-{formatCurrency(selectedTable.current_order.discount + calculateDiscount())}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(calculateFinalTotal())}</span>
                </div>
              </div>

              {/* Discount Button */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowDiscountOptions(!showDiscountOptions)}
                  className={`w-full py-2 px-4 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    showDiscountOptions || calculateDiscount() > 0
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">%</span>
                  {calculateDiscount() > 0 ? `Descuento: -${formatCurrency(calculateDiscount())}` : 'Aplicar Descuento'}
                </button>
                
                {showDiscountOptions && (
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    {/* Configured discounts */}
                    {configuredDiscounts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 font-medium">Descuentos configurados:</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setDiscountAmount(0)}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                              discountAmount === 0
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            Sin descuento
                          </button>
                          {configuredDiscounts.map(d => (
                            <button
                              key={d.id}
                              onClick={() => {
                                setDiscountAmount(d.value)
                                setDiscountType(d.discount_type === 'PERCENTAGE' ? 'percent' : 'fixed')
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                                discountAmount === d.value && discountType === (d.discount_type === 'PERCENTAGE' ? 'percent' : 'fixed')
                                  ? 'border-gray-900 bg-gray-900 text-white'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {d.name} ({d.discount_type === 'PERCENTAGE' ? `${d.value}%` : formatCurrency(d.value)})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Manual discount */}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Descuento manual:</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={discountAmount || ''}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        >
                          <option value="percent">%</option>
                          <option value="fixed">$</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Método de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'CASH', label: 'Efectivo', icon: Banknote },
                    { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
                    { value: 'TRANSFER', label: 'Transferencia', icon: DollarSign },
                  ] as const).map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        paymentMethod === method.value
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <method.icon className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash input */}
              {paymentMethod === 'CASH' && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700">Monto recibido</label>
                      <input
                        type="number"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(e.target.value)}
                        placeholder={`Mínimo: ${formatCurrency(calculateFinalTotal())}`}
                        min="0"
                        step="100"
                        autoFocus
                        className={`w-full px-4 py-3 border rounded-lg text-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                          receivedAmount && parseFloat(receivedAmount) < calculateFinalTotal() 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-200'
                        }`}
                      />
                      
                      {/* Quick amounts */}
                      <div className="flex gap-2 flex-wrap">
                        {[calculateFinalTotal(), 
                          Math.ceil(calculateFinalTotal() / 1000) * 1000,
                          Math.ceil(calculateFinalTotal() / 5000) * 5000,
                          Math.ceil(calculateFinalTotal() / 10000) * 10000,
                          Math.ceil(calculateFinalTotal() / 20000) * 20000,
                          Math.ceil(calculateFinalTotal() / 50000) * 50000
                        ].filter((v, i, a) => a.indexOf(v) === i && v >= calculateFinalTotal()).slice(0, 5).map((amount) => (
                          <button
                            key={amount}
                            onClick={() => setReceivedAmount(amount.toString())}
                            className={`px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 ${
                              receivedAmount === amount.toString() ? 'border-gray-900 bg-gray-100' : 'border-gray-200'
                            }`}
                          >
                            {formatCurrency(amount)}
                          </button>
                        ))}
                      </div>

                      {receivedAmount && parseFloat(receivedAmount) < calculateFinalTotal() && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">Faltan: {formatCurrency(calculateFinalTotal() - parseFloat(receivedAmount))}</span>
                        </div>
                      )}
                      
                      {parseFloat(receivedAmount) >= calculateFinalTotal() && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center justify-between">
                          <span className="font-medium">Cambio:</span>
                          <span className="text-xl font-bold">{formatCurrency(calculateChange())}</span>
                        </div>
                      )}
                    </div>
                  )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePrintInvoice}
                  className="flex-1 py-3 border border-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                >
                  <Printer className="h-5 w-5" />
                  Imprimir
                </button>
                <button
                  onClick={handlePayment}
                  disabled={processing || (paymentMethod === 'CASH' && (!receivedAmount || parseFloat(receivedAmount) < calculateFinalTotal()))}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Cobrar
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => setShowFEModal(true)}
                className="w-full mt-2 py-2 border border-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-gray-700"
              >
                <FileText className="h-4 w-4" />
                Factura Electrónica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Takeaway Order Payment Modal */}
      {selectedTakeawayOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="flex items-center gap-2">
                  {selectedTakeawayOrder.type === 'DELIVERY' ? (
                    <Truck className="h-5 w-5 text-blue-600" />
                  ) : (
                    <ShoppingBag className="h-5 w-5 text-blue-600" />
                  )}
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedTakeawayOrder.order_type === 'COUNTER'
                      ? 'Venta Mostrador'
                      : selectedTakeawayOrder.order_type === 'DELIVERY'
                        ? 'Domicilio'
                        : 'Para Llevar'}
                  </h2>
                </div>
                <p className="text-sm text-gray-500">
                  Orden #{selectedTakeawayOrder.order_number}
                  {selectedTakeawayOrder.waiter && ` • ${selectedTakeawayOrder.waiter.name}`}
                </p>
              </div>
              <button 
                onClick={closePaymentModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Items */}
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {selectedTakeawayOrder.items?.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.quantity}x {item.product.name}
                      </p>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Edit button */}
              <button
                onClick={() => {
                  setSelectedTakeawayOrder(null)
                  router.push(`/cajero/tomar-pedido/${selectedTakeawayOrder.id}`)
                }}
                className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                Modificar Pedido
              </button>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(selectedTakeawayOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA (8%)</span>
                  <span>{formatCurrency(selectedTakeawayOrder.tax)}</span>
                </div>
                {(selectedTakeawayOrder.discount > 0 || calculateDiscount() > 0) && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento</span>
                    <span>-{formatCurrency(selectedTakeawayOrder.discount + calculateDiscount())}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(calculateFinalTotal())}</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Método de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'CASH', label: 'Efectivo', icon: Banknote },
                    { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
                    { value: 'TRANSFER', label: 'Transferencia', icon: DollarSign },
                  ] as const).map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        paymentMethod === method.value
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <method.icon className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash input */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Monto recibido</label>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder={`Mínimo: ${formatCurrency(calculateFinalTotal())}`}
                    min="0"
                    step="100"
                    autoFocus
                    className={`w-full px-4 py-3 border rounded-lg text-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                      receivedAmount && parseFloat(receivedAmount) < calculateFinalTotal() 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-200'
                    }`}
                  />
                  
                  {/* Quick amounts */}
                  <div className="flex gap-2 flex-wrap">
                    {[calculateFinalTotal(), 
                      Math.ceil(calculateFinalTotal() / 1000) * 1000,
                      Math.ceil(calculateFinalTotal() / 5000) * 5000,
                      Math.ceil(calculateFinalTotal() / 10000) * 10000,
                      Math.ceil(calculateFinalTotal() / 20000) * 20000,
                    ].filter((v, i, a) => a.indexOf(v) === i && v >= calculateFinalTotal()).slice(0, 5).map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setReceivedAmount(amount.toString())}
                        className={`px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 ${
                          receivedAmount === amount.toString() ? 'border-gray-900 bg-gray-100' : 'border-gray-200'
                        }`}
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                  
                  {parseFloat(receivedAmount) >= calculateFinalTotal() && (
                    <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center justify-between">
                      <span className="font-medium">Cambio:</span>
                      <span className="text-xl font-bold">{formatCurrency(calculateChange())}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePrintInvoice}
                  className="flex-1 py-3 border border-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                >
                  <Printer className="h-5 w-5" />
                  Imprimir
                </button>
                <button
                  onClick={handlePayment}
                  disabled={processing || (paymentMethod === 'CASH' && (!receivedAmount || parseFloat(receivedAmount) < calculateFinalTotal()))}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Cobrar
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => setShowFEModal(true)}
                className="w-full mt-2 py-2 border border-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-gray-700"
              >
                <FileText className="h-4 w-4" />
                Factura Electrónica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factura Electrónica Modal */}
      {showFEModal && (selectedTable?.current_order || selectedTakeawayOrder) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Factura Electrónica</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Orden #{(selectedTable?.current_order || selectedTakeawayOrder)?.order_number} - {formatCurrency(calculateFinalTotal())}
                </p>
              </div>
              <button onClick={() => setShowFEModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Tipo de cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de cliente</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFEAsConsumidorFinal(true)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      feAsConsumidorFinal ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Consumidor Final
                  </button>
                  <button
                    onClick={() => setFEAsConsumidorFinal(false)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      !feAsConsumidorFinal ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Con datos del cliente
                  </button>
                </div>
              </div>

              {/* Datos del cliente */}
              {!feAsConsumidorFinal && (
                <div className="space-y-3 border-t pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Tipo de documento</label>
                      <select
                        value={feCustomer.document_type_id}
                        onChange={(e) => setFECustomer({ ...feCustomer, document_type_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                      >
                        <option value="3">Cédula de Ciudadanía</option>
                        <option value="6">NIT</option>
                        <option value="5">Cédula de Extranjería</option>
                        <option value="7">Pasaporte</option>
                        <option value="2">Tarjeta de Identidad</option>
                        <option value="8">Doc. ID Extranjero</option>
                        <option value="9">PEP</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Número de documento</label>
                      <input
                        type="text"
                        value={feCustomer.identification}
                        onChange={(e) => setFECustomer({ ...feCustomer, identification: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="Número"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nombre completo / Razón social</label>
                    <input
                      type="text"
                      value={feCustomer.names}
                      onChange={(e) => setFECustomer({ ...feCustomer, names: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Nombre o razón social"
                    />
                  </div>
                  {feCustomer.document_type_id === '6' && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Nombre comercial</label>
                      <input
                        type="text"
                        value={feCustomer.company}
                        onChange={(e) => setFECustomer({ ...feCustomer, company: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="Nombre comercial (opcional)"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Correo electrónico</label>
                      <input
                        type="email"
                        value={feCustomer.email}
                        onChange={(e) => setFECustomer({ ...feCustomer, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={feCustomer.phone}
                        onChange={(e) => setFECustomer({ ...feCustomer, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        placeholder="3001234567"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Dirección</label>
                    <input
                      type="text"
                      value={feCustomer.address}
                      onChange={(e) => setFECustomer({ ...feCustomer, address: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Dirección (opcional)"
                    />
                  </div>
                  {feCustomer.document_type_id === '6' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Organización</label>
                        <select
                          value={feCustomer.legal_organization_id}
                          onChange={(e) => setFECustomer({ ...feCustomer, legal_organization_id: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                        >
                          <option value="1">Persona Jurídica</option>
                          <option value="2">Persona Natural</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Responsabilidad fiscal</label>
                        <select
                          value={feCustomer.tribute_id}
                          onChange={(e) => setFECustomer({ ...feCustomer, tribute_id: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                        >
                          <option value="21">No aplica</option>
                          <option value="1">IVA</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resumen */}
              <div className="border-t pt-4">
                <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Orden</span>
                    <span className="font-medium">#{(selectedTable?.current_order || selectedTakeawayOrder)?.order_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cliente</span>
                    <span className="font-medium">
                      {feAsConsumidorFinal ? 'Consumidor Final' : (feCustomer.names || 'Sin nombre')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(calculateFinalTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowFEModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEmitirFE}
                  disabled={feProcessing}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {feProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Emitiendo...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Emitir Factura
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Cerrar Turno</h3>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monto de apertura</span>
                  <span className="font-medium">{formatCurrency(shift.opening_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ventas en efectivo</span>
                  <span className="font-medium text-green-600">+{formatCurrency(shift.cash_sales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ventas tarjeta</span>
                  <span className="font-medium">{formatCurrency(shift.card_sales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Transferencias</span>
                  <span className="font-medium">{formatCurrency(shift.transfer_sales)}</span>
                </div>
                {(shift.total_refunds || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500">Devoluciones</span>
                    <span className="font-medium text-red-600">-{formatCurrency(shift.total_refunds || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Efectivo esperado</span>
                  <span>{formatCurrency(shift.opening_amount + shift.cash_sales)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Efectivo contado en caja</label>
                <input
                  type="number"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {closingAmount && (
                <div className={`p-3 rounded-lg ${
                  parseFloat(closingAmount) === (shift.opening_amount + shift.cash_sales)
                    ? 'bg-green-50 text-green-700'
                    : parseFloat(closingAmount) > (shift.opening_amount + shift.cash_sales)
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-yellow-50 text-yellow-700'
                }`}>
                  <div className="flex justify-between font-medium">
                    <span>Diferencia:</span>
                    <span>
                      {(parseFloat(closingAmount) || 0) - (shift.opening_amount + shift.cash_sales) >= 0 ? '+' : ''}
                      {formatCurrency((parseFloat(closingAmount) || 0) - (shift.opening_amount + shift.cash_sales))}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  rows={2}
                  placeholder="Observaciones del turno..."
                  className="w-full mt-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCloseShift(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleCloseShift(false)}
                  disabled={processing || !closingAmount}
                  className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {processing ? 'Cerrando...' : 'Cerrar Turno'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pedidos Sin Cobrar */}
      {showPendingWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Pedidos Sin Cobrar</h3>
                  <p className="text-sm text-gray-500">Debes cobrar todos los pedidos antes de cerrar</p>
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-red-800">
                  Los siguientes pedidos no han sido cobrados. Debes cobrarlos todos antes de cerrar el turno.
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {pendingOrders.map((order, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        order.type === 'takeaway' ? 'bg-blue-500' : 'bg-red-500'
                      }`} />
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-700">{order.tableName}</span>
                        <span className={`text-xs ${
                          order.type === 'takeaway' ? 'text-blue-600' : 'text-red-600'
                        }`}>#{order.orderNumber}</span>
                      </div>
                    </div>
                    <span className="font-bold text-red-600">{formatCurrency(order.total)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gray-100 p-3 rounded-lg mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total pendiente:</span>
                  <span className="font-bold text-lg text-red-600">
                    {formatCurrency(pendingOrders.reduce((sum, o) => sum + o.total, 0))}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowPendingWarning(false)}
                className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800"
              >
                Entendido, volver a cobrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
