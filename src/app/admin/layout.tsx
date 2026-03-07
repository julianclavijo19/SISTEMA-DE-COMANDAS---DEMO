'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Printer, RotateCcw, Percent,
  Receipt, Wallet, Search, Table2, ClipboardList,
  Users, FolderTree, Package, MapPin, Warehouse, Shield,
  Settings, History, LogOut, Menu, X, ChevronDown, TrendingUp, Banknote, BarChart3, Utensils, Zap, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'

interface User {
  id: string
  name: string
  email: string
  role: string
}

// Secciones principales de Admin
const adminSections = [
  {
    title: 'Principal',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    title: 'Gestión',
    items: [
      { href: '/admin/users', label: 'Usuarios', icon: Users },
      { href: '/admin/categories', label: 'Categorías', icon: FolderTree },
      { href: '/admin/products', label: 'Productos', icon: Package },
      { href: '/admin/areas', label: 'Áreas', icon: MapPin },
      { href: '/admin/tables', label: 'Configurar Mesas', icon: Table2 },
      { href: '/admin/inventory', label: 'Inventario', icon: Warehouse },
    ]
  },
  {
    title: 'Consultas',
    items: [
      { href: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
      { href: '/admin/transacciones', label: 'Transacciones Diarias', icon: Receipt },
      { href: '/admin/reportes', label: 'Reportes', icon: TrendingUp },
      { href: '/admin/precios', label: 'Consulta Precios', icon: Search },
      { href: '/admin/facturacion-electronica', label: 'Facturación Electrónica', icon: FileText },
    ]
  },
  {
    title: 'Servicio',
    items: [
      { href: '/admin/mesas', label: 'Mesas', icon: Table2 },
    ]
  },
  {
    title: 'Sistema',
    items: [
      { href: '/admin/permissions', label: 'Permisos', icon: Shield },
      { href: '/admin/settings', label: 'Configuración', icon: Settings },
      { href: '/admin/audit', label: 'Auditoría', icon: History },
    ]
  },
]

// Sección de Caja (colapsable, cerrada por defecto)
const cajaSections = [
  {
    title: 'Cajas',
    items: [
      { href: '/admin/caja', label: 'Caja - Restaurante Chino', icon: Utensils },
      { href: '/admin/caja-comidas-rapidas', label: 'Caja - Comidas Rápidas', icon: Zap },
    ]
  },
  {
    title: 'Operaciones',
    items: [
      { href: '/admin/reimpresiones', label: 'Reimpresiones', icon: Printer },
      { href: '/admin/devoluciones', label: 'Devoluciones', icon: RotateCcw },
      { href: '/admin/descuentos', label: 'Descuentos', icon: Percent },
    ]
  },
  {
    title: 'Historial',
    items: [
      { href: '/admin/cierres-caja', label: 'Cierres de Caja', icon: Wallet },
    ]
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(['Principal', 'Gestión', 'Consultas', 'Servicio', 'Sistema'])
  const [cajaExpanded, setCajaExpanded] = useState(true)
  const [expandedCajaSections, setExpandedCajaSections] = useState<string[]>(['Cajas', 'Facturación', 'Operaciones', 'Historial'])
  const pathname = usePathname()
  const router = useRouter()

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
        if (sessionData.role !== 'ADMIN') {
          router.push('/')
          return
        }
        setUser(sessionData)
      } catch (e) {
        console.error('Error parsing session:', e)
        router.push('/login')
      }
    } else {
      router.push('/login')
    }
  }, [router])

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

  const toggleCajaSection = (title: string) => {
    setExpandedCajaSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
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
          <h1 className="text-xl font-semibold text-gray-900">Administración</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-4 px-3 pb-4 overflow-y-auto h-[calc(100vh-10rem)]">
          {/* Secciones principales de Admin */}
          {adminSections.map((section) => (
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
                    const isActive = pathname === item.href ||
                      (item.href !== '/admin' && pathname.startsWith(item.href))
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

          {/* Separador */}
          <div className="my-4 border-t border-gray-200"></div>

          {/* Sección CAJA (colapsable, cerrada por defecto) */}
          <div className="mb-2">
            <button
              onClick={() => setCajaExpanded(!cajaExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-100 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                CAJA
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${cajaExpanded ? 'rotate-180' : ''}`} />
            </button>

            {cajaExpanded && (
              <div className="mt-2 pl-2 border-l-2 border-gray-200 ml-4">
                {cajaSections.map((section) => (
                  <div key={section.title} className="mb-2">
                    <button
                      onClick={() => toggleCajaSection(section.title)}
                      className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                    >
                      {section.title}
                      <ChevronDown className={`h-3 w-3 transition-transform ${expandedCajaSections.includes(section.title) ? 'rotate-180' : ''}`} />
                    </button>

                    {expandedCajaSections.includes(section.title) && (
                      <div className="mt-1 space-y-1">
                        {section.items.map((item) => {
                          const isActive = pathname === item.href || (pathname.startsWith(item.href + '/'))
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
              </div>
            )}
          </div>
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          {user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500">Administrador</p>
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
