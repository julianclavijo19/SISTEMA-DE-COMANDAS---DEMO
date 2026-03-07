'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CreditCard, Receipt, Percent,
  Clock, BarChart3, Wallet, RotateCcw, Printer, UserCheck,
  Search, LogOut, Menu, X, ChevronDown, TrendingUp, Utensils, Zap, ShoppingBag, ClipboardList, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'

interface User {
  id: string
  name: string
  email: string
  role: string
}

const menuSections = [
  {
    title: 'Pedidos',
    items: [
      { href: '/cajero/tomar-pedido', label: 'Tomar Pedido Mesa', icon: ClipboardList },
      { href: '/cajero/para-llevar', label: 'Pedidos Para Llevar', icon: ShoppingBag },
    ]
  },
  {
    title: 'Cajas',
    items: [
      { href: '/cajero', label: 'Caja - Restaurante Chino', icon: Utensils },
      { href: '/cajero/comidas-rapidas', label: 'Caja - Comidas Rápidas', icon: Zap },
    ]
  },
  {
    title: 'Operaciones',
    items: [
      { href: '/cajero/reimpresiones', label: 'Reimpresiones', icon: Printer },
      { href: '/cajero/devoluciones', label: 'Devoluciones', icon: RotateCcw },
      { href: '/cajero/descuentos', label: 'Descuentos', icon: Percent },
    ]
  },
  {
    title: 'Historial',
    items: [
      { href: '/cajero/historial', label: 'Transacciones Diarias', icon: Receipt },
      { href: '/cajero/historial-caja', label: 'Cierres de Caja', icon: Wallet },
    ]
  },
  {
    title: 'Consultas',
    items: [
      { href: '/cajero/estadisticas', label: 'Estadísticas', icon: TrendingUp },
      { href: '/cajero/reportes', label: 'Reportes', icon: BarChart3 },
      { href: '/cajero/precios', label: 'Consulta Precios', icon: Search },
      { href: '/cajero/facturacion-electronica', label: 'Facturación Electrónica', icon: FileText },
    ]
  },
]

export default function CajeroLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(['Pedidos', 'Cajas', 'Operaciones', 'Historial', 'Consultas'])
  const pathname = usePathname()

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('Sesión cerrada')
      window.location.href = '/login'
    } catch (error) {
      toast.error('Error al cerrar sesión')
    }
  }

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Caja</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-4 px-3 pb-4 overflow-y-auto h-[calc(100vh-10rem)]">
          {menuSections.map((section) => (
            <div key={section.title} className="mb-2">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider hover:text-gray-900 hover:bg-gray-50 rounded-lg"
              >
                {section.title}
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.includes(section.title) ? 'rotate-180' : ''}`} />
              </button>

              {expandedSections.includes(section.title) && (
                <div className="mt-1 space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          {user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500">Cajero</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16">
          <div className="flex items-center justify-between h-full px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('es-CO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>

    </div>
  )
}
