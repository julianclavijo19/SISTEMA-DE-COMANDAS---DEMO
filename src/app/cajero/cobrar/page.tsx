'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { formatCurrency, formatMiles, parseMiles } from '@/lib/utils'
import {
  DollarSign, CreditCard, Receipt, Search, Users,
  Percent, CheckCircle, Split, ArrowLeft, Printer, Tag, FileText, Loader2, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { printInvoice, getAutoPrintSettings, type OrderData } from '@/lib/printer'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  notes?: string
  product: { id: string; name: string }
}

interface Order {
  id: string
  orderNumber: number
  status: string
  type?: string
  subtotal: number
  tax: number
  total: number
  discount: number
  customerCount?: number
  createdAt: string
  table: { id: string; name: string } | null
  waiter?: { name: string }
  items: OrderItem[]
}

interface ConfiguredDiscount {
  id: string
  name: string
  discount_type: 'PERCENTAGE' | 'FIXED'
  value: number
  is_active: boolean
}

function CobrarContent() {
  const searchParams = useSearchParams()
  const preselectedOrder = searchParams.get('order')

  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Configured discounts
  const [configuredDiscounts, setConfiguredDiscounts] = useState<ConfiguredDiscount[]>([])
  const [selectedConfiguredDiscount, setSelectedConfiguredDiscount] = useState<ConfiguredDiscount | null>(null)

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'mixed'>('cash')
  const [tip, setTip] = useState(0)
  const [tipType, setTipType] = useState<'fixed' | 'percent'>('percent')
  const [tipPercent, setTipPercent] = useState(10)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('percent')
  const [receivedAmount, setReceivedAmount] = useState(0)

  // Mixed payment
  const [mixedPayments, setMixedPayments] = useState<{ method: string; amount: number }[]>([])

  // Split bill
  const [splitMode, setSplitMode] = useState(false)
  const [splitWays, setSplitWays] = useState(2)
  const [splitByItems, setSplitByItems] = useState(false)

  // Factura Electrónica
  const [showFEModal, setShowFEModal] = useState(false)
  const [feProcessing, setFEProcessing] = useState(false)
  const [feCustomer, setFECustomer] = useState({
    document_type_id: '3',
    identification: '',
    names: '',
    email: '',
    phone: '',
    address: '',
    company: '',
    legal_organization_id: '2',
    tribute_id: '21',
  })
  const [feAsConsumidorFinal, setFEAsConsumidorFinal] = useState(true)

  useEffect(() => {
    fetchOrders()
    fetchDiscounts()
  }, [])

  useEffect(() => {
    if (preselectedOrder && orders.length > 0) {
      const order = orders.find(o => o.id === preselectedOrder)
      if (order) setSelectedOrder(order)
    }
  }, [preselectedOrder, orders])

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders?status=delivered&unpaid=true')
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/cajero/descuentos/configurar')
      if (res.ok) {
        const data = await res.json()
        setConfiguredDiscounts((data.discounts || []).filter((d: ConfiguredDiscount) => d.is_active))
      }
    } catch (error) {
      console.error('Error fetching discounts:', error)
    }
  }

  const applyConfiguredDiscount = (configDiscount: ConfiguredDiscount | null) => {
    if (configDiscount) {
      setSelectedConfiguredDiscount(configDiscount)
      setDiscount(configDiscount.value)
      setDiscountType(configDiscount.discount_type === 'PERCENTAGE' ? 'percent' : 'fixed')
    } else {
      setSelectedConfiguredDiscount(null)
      setDiscount(0)
    }
  }

  const calculateTip = () => {
    if (tipType === 'percent') {
      return (selectedOrder?.subtotal || 0) * (tipPercent / 100)
    }
    return tip
  }

  const calculateDiscount = () => {
    if (discountType === 'percent') {
      return (selectedOrder?.subtotal || 0) * (discount / 100)
    }
    return discount
  }

  const calculateTotal = () => {
    if (!selectedOrder) return 0
    const subtotal = selectedOrder.subtotal
    const discountAmount = calculateDiscount()
    const tipAmount = calculateTip()
    const taxable = subtotal - discountAmount
    const tax = taxable * 0.08
    return taxable + tax + tipAmount
  }

  const calculateChange = () => {
    const total = calculateTotal()
    if (paymentMethod === 'cash') {
      return Math.max(0, receivedAmount - total)
    }
    if (paymentMethod === 'mixed') {
      const totalPaid = mixedPayments.reduce((s, p) => s + p.amount, 0)
      return Math.max(0, totalPaid - total)
    }
    return 0
  }

  const handlePayment = async () => {
    if (!selectedOrder) return

    const total = calculateTotal()

    if (paymentMethod === 'cash' && receivedAmount < total) {
      toast.error('Monto recibido insuficiente')
      return
    }

    if (paymentMethod === 'mixed') {
      const totalPaid = mixedPayments.reduce((s, p) => s + p.amount, 0)
      if (totalPaid < total) {
        toast.error('El total de pagos es insuficiente')
        return
      }
    }

    setProcessing(true)
    try {
      const tipAmount = calculateTip()
      const discountAmount = calculateDiscount()
      const discountTypeApi = discountType === 'percent' ? 'percentage' : 'fixed'

      let body: Record<string, unknown> = {
        payment_method: paymentMethod === 'mixed' ? 'CASH' : paymentMethod,
        tip: tipAmount,
        discount: discountAmount,
        discount_type: discountTypeApi,
        received_amount: paymentMethod === 'cash' ? receivedAmount : total,
        change_amount: calculateChange(),
        mixed_payments: paymentMethod === 'mixed' ? mixedPayments : undefined
      }

      if (splitMode && splitWays >= 2) {
        const perPerson = total / splitWays
        const splitPayments = Array.from({ length: splitWays }, (_, i) => ({
          method: i === splitWays - 1 ? (paymentMethod === 'mixed' ? (mixedPayments[0]?.method || 'CASH') : paymentMethod) : (paymentMethod === 'mixed' ? (mixedPayments[0]?.method || 'CASH') : paymentMethod),
          amount: i === splitWays - 1 ? Math.round((total - perPerson * (splitWays - 1)) * 100) / 100 : Math.round(perPerson * 100) / 100
        }))
        body = {
          ...body,
          split_payments: splitPayments,
          payment_method: paymentMethod === 'mixed' ? (mixedPayments[0]?.method || 'CASH') : paymentMethod
        }
      }

      const res = await fetch(`/api/orders/${selectedOrder.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        // openCashDrawer se ejecuta desde el API (print_queue) → cash-drawer-script
        const printSettings = getAutoPrintSettings()
        if (printSettings.invoice) {
          await handlePrintInvoice()
        }

        toast.success(`Pago procesado. Cambio: ${formatCurrency(calculateChange())}`)
        setSelectedOrder(null)
        resetPaymentState()
        fetchOrders()
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

  // Función para imprimir factura
  const handlePrintInvoice = async () => {
    if (!selectedOrder) return

    const orderData: OrderData = {
      orderNumber: selectedOrder.orderNumber,
      tableName: selectedOrder.table?.name || '',
      waiterName: selectedOrder.waiter?.name || '',
      createdAt: selectedOrder.createdAt,
      items: selectedOrder.items.map(item => ({
        quantity: item.quantity,
        product: { name: item.product.name },
        unitPrice: item.unitPrice,
        notes: item.notes
      })),
      subtotal: selectedOrder.subtotal,
      tax: (selectedOrder.subtotal - calculateDiscount()) * 0.08,
      total: calculateTotal(),
      discount: calculateDiscount(),
      tip: calculateTip(),
      paymentMethod: paymentMethod,
      receivedAmount: paymentMethod === 'cash' ? receivedAmount : calculateTotal(),
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

  const resetPaymentState = () => {
    setPaymentMethod('cash')
    setTip(0)
    setTipPercent(10)
    setDiscount(0)
    setReceivedAmount(0)
    setMixedPayments([])
    setSplitMode(false)
    setSelectedConfiguredDiscount(null)
    setShowFEModal(false)
    setFEAsConsumidorFinal(true)
    setFECustomer({
      document_type_id: '3',
      identification: '',
      names: '',
      email: '',
      phone: '',
      address: '',
      company: '',
      legal_organization_id: '2',
      tribute_id: '21',
    })
  }

  // Emitir factura electrónica
  const handleEmitirFE = async () => {
    if (!selectedOrder) return
    setFEProcessing(true)
    try {
      const body: any = {
        order_id: selectedOrder.id,
        payment_method: paymentMethod,
      }

      if (!feAsConsumidorFinal) {
        if (!feCustomer.identification || !feCustomer.names) {
          toast.error('Ingrese identificación y nombre del cliente')
          setFEProcessing(false)
          return
        }
        body.customer = feCustomer
      }

      const res = await fetch('/api/facturacion/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await res.json()

      if (res.ok) {
        const billNumber = result.data?.bill?.number
        toast.success(`Factura electrónica ${billNumber || ''} emitida`)
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

  const addMixedPayment = (method: string) => {
    setMixedPayments([...mixedPayments, { method, amount: 0 }])
  }

  const updateMixedPayment = (index: number, amount: number) => {
    const updated = [...mixedPayments]
    updated[index].amount = amount
    setMixedPayments(updated)
  }

  const removeMixedPayment = (index: number) => {
    setMixedPayments(mixedPayments.filter((_, i) => i !== index))
  }

  const filteredOrders = orders.filter(o =>
    o.orderNumber.toString().includes(searchQuery) ||
    (o.table?.name || 'para llevar').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Separate table orders from takeaway orders
  const tableOrders = filteredOrders.filter(o => o.table !== null && o.table !== undefined && o.type !== 'TAKEOUT')
  const takeawayOrders = filteredOrders.filter(o => o.table === null || o.table === undefined || o.type === 'TAKEOUT')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {selectedOrder && (
          <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {selectedOrder ? `Cobrar #${selectedOrder.orderNumber}` : 'Cobrar'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {selectedOrder ? (selectedOrder.table?.name || 'Para Llevar') : `${orders.length} pedidos pendientes`}
          </p>
        </div>
      </div>

      {!selectedOrder ? (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o mesa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Orders list */}
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No hay cuentas pendientes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Takeaway orders section */}
              {takeawayOrders.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Para Llevar ({takeawayOrders.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {takeawayOrders.map(order => (
                      <Card
                        key={order.id}
                        className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-gray-900"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-lg font-semibold">#{order.orderNumber}</span>
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded ml-2">Para Llevar</span>
                            </div>
                            <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.items.length} items • {order.waiter?.name || 'Sin asignar'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(order.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Table orders section */}
              {tableOrders.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Mesas ({tableOrders.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tableOrders.map(order => (
                      <Card
                        key={order.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-lg font-semibold">#{order.orderNumber}</span>
                              <span className="text-gray-500 ml-2">{order.table?.name}</span>
                            </div>
                            <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.items.length} items • {order.waiter?.name || 'Sin mesero'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(order.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order details */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Detalle de la Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{item.quantity}x {item.product.name}</p>
                      {item.notes && <p className="text-xs text-gray-500">{item.notes}</p>}
                    </div>
                    <span className="font-medium">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {calculateDiscount() > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Descuento</span>
                    <span>-{formatCurrency(calculateDiscount())}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA (8%)</span>
                  <span>{formatCurrency((selectedOrder.subtotal - calculateDiscount()) * 0.08)}</span>
                </div>
                {calculateTip() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Propina</span>
                    <span>{formatCurrency(calculateTip())}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment options */}
          <div className="space-y-4">
            {/* Payment method */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">Método de Pago</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'Efectivo', icon: DollarSign },
                    { id: 'card', label: 'Tarjeta', icon: CreditCard },
                    { id: 'transfer', label: 'Transfer', icon: Receipt },
                    { id: 'mixed', label: 'Mixto', icon: Split },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-3 rounded-lg border text-center transition-colors ${paymentMethod === m.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      <m.icon className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs">{m.label}</span>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'cash' && (
                  <div className="mt-4">
                    <label className="block text-sm text-gray-600 mb-2">Monto Recibido</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={receivedAmount ? formatMiles(receivedAmount) : ''}
                      onChange={(e) => {
                        const val = parseMiles(e.target.value)
                        if (/^[0-9]*$/.test(val)) setReceivedAmount(parseFloat(val) || 0)
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="0"
                    />
                    <div className="flex gap-2 mt-2">
                      {[50000, 100000, 200000].map(amount => (
                        <button
                          key={amount}
                          onClick={() => setReceivedAmount(amount)}
                          className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          {formatCurrency(amount)}
                        </button>
                      ))}
                    </div>
                    {receivedAmount > 0 && (
                      <div className="mt-3 p-3 bg-gray-100 rounded-lg text-center">
                        <span className="text-sm text-gray-600">Cambio: </span>
                        <span className="text-xl font-bold">{formatCurrency(calculateChange())}</span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'mixed' && (
                  <div className="mt-4 space-y-3">
                    {mixedPayments.map((payment, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm w-24 capitalize">{payment.method === 'cash' ? 'Efectivo' : payment.method === 'card' ? 'Tarjeta' : 'Transfer'}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={payment.amount ? formatMiles(payment.amount) : ''}
                          onChange={(e) => {
                            const val = parseMiles(e.target.value)
                            if (/^[0-9]*$/.test(val)) updateMixedPayment(index, parseFloat(val) || 0)
                          }}
                          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                        <button
                          onClick={() => removeMixedPayment(index)}
                          className="p-2 text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button onClick={() => addMixedPayment('cash')} className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50">+ Efectivo</button>
                      <button onClick={() => addMixedPayment('card')} className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50">+ Tarjeta</button>
                      <button onClick={() => addMixedPayment('transfer')} className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50">+ Transfer</button>
                    </div>
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Total pagos:</span>
                        <span className="font-bold">{formatCurrency(mixedPayments.reduce((s, p) => s + p.amount, 0))}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span>Faltante:</span>
                        <span className="font-bold">{formatCurrency(Math.max(0, calculateTotal() - mixedPayments.reduce((s, p) => s + p.amount, 0)))}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tip & Discount */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">Propina y Descuento</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Tip */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Propina</label>
                  <div className="flex gap-2">
                    {[0, 10, 15, 20].map(p => (
                      <button
                        key={p}
                        onClick={() => { setTipType('percent'); setTipPercent(p) }}
                        className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${tipType === 'percent' && tipPercent === p
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        {p === 0 ? 'Sin' : `${p}%`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={tipType === 'fixed' ? (tip ? formatMiles(tip) : '') : ''}
                      onChange={(e) => { const v = parseMiles(e.target.value); if (/^[0-9]*$/.test(v)) { setTipType('fixed'); setTip(parseFloat(v) || 0) } }}
                      placeholder="Monto fijo"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                {/* Discount */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Descuento</label>

                  {/* Configured discounts */}
                  {configuredDiscounts.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">Descuentos disponibles:</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => applyConfiguredDiscount(null)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${!selectedConfiguredDiscount && discount === 0
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          Sin descuento
                        </button>
                        {configuredDiscounts.map(d => (
                          <button
                            key={d.id}
                            onClick={() => applyConfiguredDiscount(d)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selectedConfiguredDiscount?.id === d.id
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
                  <p className="text-xs text-gray-500 mb-2">O ingresa manualmente:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={discount ? formatMiles(discount) : ''}
                      onChange={(e) => { const v = parseMiles(e.target.value); if (/^[0-9]*$/.test(v)) { setSelectedConfiguredDiscount(null); setDiscount(parseFloat(v) || 0) } }}
                      placeholder="0"
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => {
                        setSelectedConfiguredDiscount(null)
                        setDiscountType(e.target.value as any)
                      }}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="percent">%</option>
                      <option value="fixed">$</option>
                    </select>
                  </div>

                  {calculateDiscount() > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded-lg text-sm text-green-700">
                      Descuento: -{formatCurrency(calculateDiscount())}
                      {selectedConfiguredDiscount && (
                        <span className="ml-1 text-xs">({selectedConfiguredDiscount.name})</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Split bill */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Dividir Cuenta</CardTitle>
                  <button
                    onClick={() => setSplitMode(!splitMode)}
                    className={`px-3 py-1 rounded text-sm ${splitMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}
                  >
                    {splitMode ? 'Activado' : 'Activar'}
                  </button>
                </div>
              </CardHeader>
              {splitMode && (
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="text-sm text-gray-600">Dividir entre:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={splitWays}
                      onChange={(e) => { const v = e.target.value; if (/^[0-9]*$/.test(v)) setSplitWays(parseInt(v) || 2) }}
                      className="w-20 px-3 py-2 border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-500">personas</span>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Cada persona paga:</p>
                    <p className="text-2xl font-bold">{formatCurrency(calculateTotal() / splitWays)}</p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Action buttons */}
            <div className="space-y-2">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setSelectedOrder(null); resetPaymentState() }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={handlePayment}
                  disabled={processing}
                >
                  {processing ? 'Procesando...' : `Cobrar ${formatCurrency(calculateTotal())}`}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handlePrintInvoice}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Pre-cuenta
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowFEModal(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Factura Electrónica
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Factura Electrónica */}
      {showFEModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Factura Electrónica</CardTitle>
                <button onClick={() => setShowFEModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Orden #{selectedOrder.orderNumber} - {formatCurrency(calculateTotal())}
              </p>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Tipo de cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de cliente</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFEAsConsumidorFinal(true)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      feAsConsumidorFinal
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Consumidor Final
                  </button>
                  <button
                    onClick={() => setFEAsConsumidorFinal(false)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      !feAsConsumidorFinal
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-200 hover:bg-gray-50'
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
                    <span className="font-medium">#{selectedOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cliente</span>
                    <span className="font-medium">
                      {feAsConsumidorFinal ? 'Consumidor Final' : (feCustomer.names || 'Sin nombre')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowFEModal(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={handleEmitirFE}
                  disabled={feProcessing}
                >
                  {feProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Emitiendo...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Emitir Factura
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function CobrarPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <CobrarContent />
    </Suspense>
  )
}
