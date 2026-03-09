'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Download,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  totalSales: number
  totalOrders: number
  activeTables: number
  totalTables: number
  dailySales: { date: string; total: number }[]
  topProducts: { product: { name: string }; _sum: { quantity: number } }[]
}

type Period = 'today' | 'week' | 'month'

// Compact bar chart for the estadísticas card
function MiniBarChart({ data, loading }: { data: { date: string; total: number }[]; loading: boolean }) {
  const [animateIn, setAnimateIn] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && data.length > 0) {
      setAnimateIn(false)
      const timer = setTimeout(() => setAnimateIn(true), 50)
      return () => clearTimeout(timer)
    }
  }, [data, loading])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-900 border-t-transparent"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <BarChart3 className="h-8 w-8 mb-2" />
        <p className="text-xs">Sin datos</p>
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => d.total), 1)

  return (
    <div className="relative h-40">
      <div className="absolute bottom-6 left-0 right-0 top-0 flex items-end gap-1">
        {data.map((point, index) => {
          const heightPercent = maxVal > 0 ? (point.total / maxVal) * 100 : 0
          const isHovered = hoveredIndex === index
          return (
            <div
              key={index}
              className="relative flex-1 flex flex-col items-center justify-end"
              style={{ height: '100%' }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {isHovered && point.total > 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  {formatCurrency(point.total)}
                </div>
              )}
              <div
                className="w-full rounded-t-sm cursor-pointer transition-all duration-500 ease-out"
                style={{
                  height: animateIn ? `${heightPercent}%` : '0%',
                  backgroundColor: isHovered ? '#111827' : (point.total > 0 ? '#374151' : '#f3f4f6'),
                  transitionDelay: `${index * 30}ms`,
                  minHeight: point.total > 0 ? 2 : 0,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex">
        {data.map((point, index) => {
          const showLabel = data.length <= 8 || index % Math.ceil(data.length / 8) === 0
          return (
            <div key={index} className="flex-1 text-center">
              {showLabel && (
                <span className="text-[9px] text-gray-400">{point.date}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>('today')
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalOrders: 0,
    activeTables: 0,
    totalTables: 0,
    dailySales: [],
    topProducts: [],
  })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setStats({
          totalSales: data.totalSales || 0,
          totalOrders: data.totalOrders || 0,
          activeTables: data.activeTables || 0,
          totalTables: data.totalTables || 0,
          dailySales: data.dailySales || [],
          topProducts: (data.topProducts || []).slice(0, 5),
        })
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleExport = async () => {
    setExporting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/estadisticas/export?period=${period === 'today' ? 'day' : period}&date=${today}`)
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard-${period}-${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export error:', e)
    } finally {
      setExporting(false)
    }
  }

  const avgTicket = stats.totalOrders > 0 ? stats.totalSales / stats.totalOrders : 0
  const totalPeriodSales = stats.dailySales.reduce((s, d) => s + d.total, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Resumen general del negocio</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          >
            <option value="today">Hoy</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={fetchStats}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* KPI Cards - 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Ventas Totales</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalSales)}</p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {stats.totalOrders} órdenes pagadas
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Total Ordenes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
          <p className="text-xs text-gray-400 mt-1">Todas las órdenes del periodo</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Mesas Ocupadas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.activeTables}<span className="text-base font-normal text-gray-400">/{stats.totalTables}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Capacidad actual</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Ticket Promedio</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(avgTicket)}</p>
          <p className="text-xs text-gray-400 mt-1">Por orden</p>
        </div>
      </div>

      {/* Bottom row: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Estadísticas card */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Estadísticas</h2>
            <Link href="/admin/estadisticas" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              Ver más <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Total del periodo</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalPeriodSales)}</p>
            </div>
            <MiniBarChart data={stats.dailySales} loading={loading} />
          </div>
        </div>

        {/* Acciones Rápidas card */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Acciones Rápidas</h2>
          </div>
          <div className="p-2">
            {[
              { href: '/admin/products', label: 'Gestionar productos' },
              { href: '/admin/estadisticas', label: 'Ver estadísticas' },
              { href: '/admin/users', label: 'Administrar usuarios' },
              { href: '/admin/reportes', label: 'Ver reportes' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-gray-700">{action.label}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>

        {/* Productos Más Vendidos card */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Productos Más Vendidos</h2>
            <Link href="/admin/estadisticas" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              Ver más <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-900 border-t-transparent"></div>
              </div>
            ) : stats.topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin ventas en este periodo</p>
            ) : (
              stats.topProducts.map((item, index) => (
                <div key={index} className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-900 font-medium">{item.product?.name || 'Producto'}</span>
                  </div>
                  <span className="text-sm text-gray-500">{item._sum?.quantity || 0} uds</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
