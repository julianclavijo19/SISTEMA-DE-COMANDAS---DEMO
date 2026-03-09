'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { 
  ShoppingBag, Plus, Minus, Trash2, Search, 
  Send, RefreshCw, Clock, ArrowLeft
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
  priority: 'normal' | 'urgent'
  tiempo?: 'entrada' | 'plato_fuerte' | 'postre'
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface Shift {
  id: string
  status: string
}

export default function MeseroParaLlevarPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [shift, setShift] = useState<Shift | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderNotes, setOrderNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

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

  // Fetch shift
  const fetchShift = useCallback(async () => {
    try {
      const res = await fetch('/api/cajero/turno')
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }, [])

  // Fetch categories with products
  const fetchData = useCallback(async () => {
    try {
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
  }, [])

  useEffect(() => {
    fetchShift()
    fetchData()
  }, [fetchShift, fetchData])

  // Cart functions
  const addToCart = (product: Product) => {
    const itemId = `${product.id}-${Date.now()}`
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && !item.notes)
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
        priority: 'normal'
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

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId))
  }

  const clearCart = () => setCart([])

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  // Send order to kitchen (without payment)
  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      toast.error('Agrega productos al pedido')
      return
    }

    if (!shift) {
      toast.error('El cajero debe abrir turno primero')
      return
    }

    setSending(true)
    try {
      // Create order with type TAKEOUT - without payment
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiter_id: user?.id,
          orderType: 'TAKEOUT',
          notes: orderNotes,
          items: cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            notes: item.notes || '',
            priority: item.priority,
            tiempo: item.tiempo
          }))
        })
      })

      if (!orderRes.ok) {
        const error = await orderRes.json()
        throw new Error(error.error || 'Error creando orden')
      }

      const orderData = await orderRes.json()

      // Show success message
      if (orderData.printResult?.success) {
        toast.success('Pedido enviado a cocina - Comanda impresa')
      } else {
        toast.success('Pedido enviado a cocina')
        if (orderData.printResult?.error) {
          toast.error('Error impresora: ' + orderData.printResult.error)
        }
      }

      // Clear cart and redirect to main mesero page
      clearCart()
      setOrderNotes('')
      router.push('/mesero')
      
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al enviar el pedido')
    } finally {
      setSending(false)
    }
  }

  // Filter products
  const filteredProducts = searchQuery
    ? categories.flatMap(c => c.products).filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories.find(c => c.id === selectedCategory)?.products || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // No shift - show warning
  if (!shift) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay turno abierto</h2>
            <p className="text-gray-500 mb-6">El cajero debe abrir turno para crear pedidos para llevar</p>
            <Link
              href="/mesero"
              className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Volver a Mesas
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/mesero"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Pedido Para Llevar</h1>
            <p className="text-gray-500 text-sm mt-1">Crear pedido sin mesa - se enviará a cocina y caja</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
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
          <Card className="sticky top-4">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-blue-500" />
                  Para Llevar
                </CardTitle>
                <span className="text-sm text-gray-500">{cart.length} items</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">
                  Selecciona productos para agregar
                </p>
              ) : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {cart.map((item) => (
                    <div 
                      key={item.id} 
                      className={`border border-gray-200 rounded-lg p-3 ${
                        item.priority === 'urgent' ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{item.product.name}</p>
                          <p className="text-gray-600 text-sm">
                            {formatCurrency(item.product.price * item.quantity)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Minus className="h-4 w-4 text-gray-600" />
                          </button>
                          <span className="w-6 text-center font-medium text-sm">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Plus className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Item options */}
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          placeholder="Notas especiales..."
                          value={item.notes}
                          onChange={(e) => updateItemNotes(item.id, e.target.value)}
                          className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                        />

                        <div className="flex gap-2">
                          <select
                            value={item.tiempo || ''}
                            onChange={(e) => updateItemTiempo(item.id, e.target.value as any || undefined)}
                            className="text-xs px-2 py-1.5 border border-gray-200 rounded flex-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
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
                                ? 'bg-blue-500 text-white border-blue-500' 
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Urgente
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Order notes */}
              {cart.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notas generales del pedido</label>
                  <textarea
                    placeholder="Notas para todo el pedido..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-900"
                    rows={2}
                  />
                </div>
              )}

              {/* Total */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span className="text-gray-700">Total</span>
                  <span className="text-gray-900">{formatCurrency(total)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  El cobro se realizará en la caja principal
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  onClick={handleSendToKitchen}
                  disabled={cart.length === 0 || sending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar a Cocina
                </Button>

                {cart.length > 0 && (
                  <Button
                    onClick={clearCart}
                    variant="outline"
                    className="w-full"
                  >
                    Limpiar Pedido
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
