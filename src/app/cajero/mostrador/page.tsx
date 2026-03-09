'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, 
  CheckCircle, RefreshCw, Clock, ArrowLeft
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

export default function MostradorPage() {
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
      return [...prev, { id: itemId, product, quantity: 1, notes: '' }]
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

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId))
  }

  const clearCart = () => setCart([])

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  // Crear venta directa por mostrador (tipo COUNTER - no va a cocina)
  const handleCrearVenta = async () => {
    if (cart.length === 0) {
      toast.error('Agrega productos a la venta')
      return
    }

    if (!shift) {
      toast.error('Debes abrir turno primero')
      return
    }

    setSending(true)
    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiter_id: user?.id,
          orderType: 'COUNTER',
          notes: orderNotes,
          items: cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            notes: item.notes || '',
          }))
        })
      })

      if (!orderRes.ok) {
        const error = await orderRes.json()
        throw new Error(error.error || 'Error creando venta')
      }

      toast.success('Venta por mostrador creada — lista para cobrar')
      clearCart()
      setOrderNotes('')
      router.push('/cajero')

    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al crear la venta')
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

  if (!shift) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No hay turno abierto</h2>
            <p className="text-gray-500 mb-6">Abre un turno en la caja principal para crear ventas por mostrador</p>
            <a
              href="/cajero"
              className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Ir a Caja Principal
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/cajero"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-gray-700" />
              Venta por Mostrador
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">La venta quedará lista para cobrar en caja</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-green-700">Turno activo</span>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Categories */}
          {!searchQuery && (
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Products grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className={`relative p-3 border rounded-lg text-left transition-colors ${cart.find(i => i.product.id === product.id) ? 'border-blue-400 ring-1 ring-blue-400 bg-blue-50/30' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}
              >
                {cart.find(i => i.product.id === product.id)?.quantity ? (
                  <span className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.find(i => i.product.id === product.id)!.quantity}
                  </span>
                ) : null}
                <p className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">
                  {product.name}
                </p>
                <p className="text-gray-600 font-semibold mt-1">{formatCurrency(product.price)}</p>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No hay productos disponibles</p>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <Card className="border-gray-200">
            <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
              <CardTitle className="text-base text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Venta actual ({cart.length} productos)
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
                    <div key={item.id} className="border border-gray-100 rounded-lg p-3">
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
                  placeholder="Nota general del pedido..."
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
                  onClick={handleCrearVenta}
                  disabled={sending || cart.length === 0}
                  className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Crear venta — Ir a cobrar
                    </>
                  )}
                </button>

                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Limpiar carrito
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
