'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { 
  Plus, Minus, Trash2, Send, ArrowLeft, Search, 
  Save, Clock, Users, Printer, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  price: number
  description?: string
  prepTime?: number
  category: { name: string; id: string }
}

interface Category {
  id: string
  name: string
  color?: string
  products: Product[]
}

interface CartItem {
  id: string
  product: Product
  quantity: number
  notes: string
  comensal?: number
  priority: 'normal' | 'urgent'
  sentToKitchen: boolean
  tiempo?: 'entrada' | 'plato_fuerte' | 'postre'
}

interface Shift {
  id: string
  status: string
  opened_at: string
}

function NuevaComandaCajeroContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tableId = searchParams.get('table')
  
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [table, setTable] = useState<{ id: string; name: string; capacity: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [customerCount, setCustomerCount] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)
  const [shift, setShift] = useState<Shift | null>(null)
  const [shiftLoading, setShiftLoading] = useState(true)

  // Fetch shift status
  const fetchShift = useCallback(async () => {
    try {
      const res = await fetch('/api/cajero/turno')
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift)
      }
    } catch (error) {
      console.error('Error fetching shift:', error)
    } finally {
      setShiftLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShift()
  }, [fetchShift])

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
        setUserId(sessionData.id)
      } catch (e) {
        console.error('Error:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (tableId) {
      fetchData()
    }
  }, [tableId])

  const fetchData = async () => {
    try {
      const tableRes = await fetch(`/api/tables/${tableId}`)
      if (tableRes.ok) {
        const tableData = await tableRes.json()
        setTable(tableData)
      }

      const catRes = await fetch('/api/categories?includeProducts=true')
      if (catRes.ok) {
        const catData = await catRes.json()
        setCategories(catData)
        if (catData.length > 0) {
          setSelectedCategory(catData[0].id)
        }
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: Product) => {
    const itemId = `${product.id}-${Date.now()}`
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && !item.sentToKitchen && !item.notes)
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { 
        id: itemId,
        product, 
        quantity: 1, 
        notes: '',
        priority: 'normal',
        sentToKitchen: false
      }]
    })
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const updateItemNotes = (itemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, notes } : item
      )
    )
  }

  const updateItemPriority = (itemId: string, priority: 'normal' | 'urgent') => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, priority } : item
      )
    )
  }

  const updateItemTiempo = (itemId: string, tiempo: 'entrada' | 'plato_fuerte' | 'postre' | undefined) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, tiempo } : item
      )
    )
  }

  const updateItemComensal = (itemId: string, comensal: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, comensal } : item
      )
    )
  }

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId))
  }

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  const handleSubmit = async (sendAll: boolean = true) => {
    const itemsToSend = sendAll 
      ? cart.filter(item => !item.sentToKitchen)
      : cart.filter(item => !item.sentToKitchen && item.tiempo === 'entrada')

    if (itemsToSend.length === 0) {
      toast.error('No hay items para enviar')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          waiter_id: userId,
          notes: orderNotes,
          customer_count: customerCount,
          items: itemsToSend.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            notes: item.notes,
            priority: item.priority,
            tiempo: item.tiempo,
            comensal: item.comensal,
          })),
        }),
      })

      if (res.ok) {
        const order = await res.json()
        
        // Show print result
        if (order.printResult?.success) {
          toast.success('Pedido enviado - Comanda impresa')
        } else {
          toast.success('Pedido enviado')
          if (order.printResult?.error) {
            toast.error('Error impresora: ' + order.printResult.error)
          }
        }
        
        // Volver a la lista de mesas
        router.push('/cajero/tomar-pedido')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Error al enviar comanda')
      }
    } catch (error) {
      console.error('Error en handleSubmit:', error)
      toast.error('Error al enviar comanda')
    } finally {
      setSending(false)
    }
  }

  const filteredProducts = searchQuery
    ? categories.flatMap(c => c.products).filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories.find(c => c.id === selectedCategory)?.products || []

  if (loading || shiftLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // No shift open - show warning
  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-yellow-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">No hay turno abierto</h2>
        <p className="text-gray-500 text-center max-w-md">
          Debes abrir un turno de caja antes de poder tomar pedidos.
        </p>
        <Link
          href="/cajero"
          className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Ir a Caja
        </Link>
      </div>
    )
  }

  if (!tableId || !table) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Mesa no encontrada</p>
        <Link href="/cajero/tomar-pedido" className="text-gray-900 hover:underline mt-2 inline-block">
          Volver a mesas
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/cajero/tomar-pedido"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Nueva Comanda</h1>
            <div className="flex items-center gap-3 text-gray-500 text-sm mt-1">
              <span>Mesa: {table.name}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customerCount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    const num = parseInt(val) || 1
                    setCustomerCount(Math.min(table.capacity, Math.max(1, num)))
                  }}
                  className="w-12 text-center border border-gray-200 rounded px-1"
                />
                <span>comensales</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {/* Categories */}
          {!searchQuery && (
            <div className="flex gap-2 flex-wrap">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          {/* Products list */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.product.id === product.id)
              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer hover:shadow-md transition-all active:scale-98 ${inCart ? 'ring-1 ring-blue-400' : ''}`}
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4 relative">
                    {inCart && (
                      <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</h3>
                    <p className="text-gray-900 font-semibold mt-2">
                      {formatCurrency(product.price)}
                    </p>
                    {product.prepTime && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Clock className="h-3 w-3" />
                        {product.prepTime} min
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredProducts.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              {searchQuery ? 'No se encontraron productos' : 'No hay productos en esta categoría'}
            </p>
          )}
        </div>

        {/* Cart */}
        <div className="lg:col-span-1">
          <Card className="border-gray-200">
            <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
              <CardTitle className="text-base text-gray-900 flex items-center gap-2">
                Comanda — {table.name} ({cart.length} productos)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Selecciona productos
                </div>
              ) : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className={`border border-gray-100 rounded-lg p-3 ${item.priority === 'urgent' ? 'border-gray-900 bg-gray-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-gray-900 flex-1 leading-tight">
                          {item.product.name}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-bold text-gray-900 w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-7 h-7 rounded-md bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="font-bold text-gray-900 text-sm">
                          {formatCurrency(item.product.price * item.quantity)}
                        </span>
                      </div>

                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItemNotes(item.id, e.target.value)}
                        placeholder="Nota (opcional)"
                        className="w-full mt-2 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-300"
                      />

                      <div className="flex gap-2 mt-2">
                        <select
                          value={item.tiempo || ''}
                          onChange={(e) => updateItemTiempo(item.id, e.target.value as any || undefined)}
                          className="text-xs px-2 py-1.5 border border-gray-200 rounded flex-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                        >
                          <option value="">Tiempo</option>
                          <option value="entrada">Entrada</option>
                          <option value="plato_fuerte">Plato fuerte</option>
                          <option value="postre">Postre</option>
                        </select>

                        <button
                          onClick={() => updateItemPriority(item.id, item.priority === 'urgent' ? 'normal' : 'urgent')}
                          className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                            item.priority === 'urgent' 
                              ? 'bg-gray-900 text-white border-gray-900' 
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Urgente
                        </button>
                      </div>

                      {customerCount > 1 && (
                        <select
                          value={item.comensal || ''}
                          onChange={(e) => updateItemComensal(item.id, parseInt(e.target.value) || 0)}
                          className="text-xs px-2 py-1.5 border border-gray-200 rounded w-full mt-2 focus:outline-none focus:ring-1 focus:ring-gray-300"
                        >
                          <option value="">Todos los comensales</option>
                          {Array.from({ length: customerCount }, (_, i) => (
                            <option key={i + 1} value={i + 1}>Comensal {i + 1}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div className="mt-3">
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Nota general de la comanda..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Total */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-500">Total estimado</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(total)}</span>
                </div>

                <button
                  onClick={() => handleSubmit(true)}
                  disabled={sending || cart.length === 0}
                  className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Enviar a Cocina
                    </>
                  )}
                </button>

                {cart.some(item => item.tiempo === 'entrada') && (
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={sending}
                    className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors"
                  >
                    Solo Entradas
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function NuevaComandaCajeroPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <NuevaComandaCajeroContent />
    </Suspense>
  )
}
