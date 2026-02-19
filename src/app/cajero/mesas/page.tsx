'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { 
  Table2, Clock, Users, DollarSign, ChefHat, 
  CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react'
import { TableDiningIcon } from '@/components/ui/table-dining-icon'
import Link from 'next/link'

interface Area {
  id: string
  name: string
  color?: string
}

interface Table {
  id: string
  name: string
  capacity: number
  status: string
  area: Area
  current_order?: {
    id: string
    orderNumber: number
    status: string
    total: number
    items: {
      id: string
      status: string
      product: { name: string }
    }[]
    createdAt: string
  }
}

export default function MesasCajeroPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    fetchTables()
    const interval = setInterval(fetchTables, 15000)
    return () => clearInterval(interval)
  }, [])

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/cajero/mesas')
      if (res.ok) {
        const data = await res.json()
        // El API cajero/mesas devuelve { areas: [...], stats: {...}, orders: [...] }
        // Cada area tiene .tables con las mesas y sus current_order
        const allTables = (data.areas || []).flatMap((area: any) => 
          (area.tables || []).map((table: any) => ({
            ...table,
            area: { id: area.id, name: area.name }
          }))
        )
        setTables(allTables)
        setAreas((data.areas || []).map((a: any) => ({ id: a.id, name: a.name })))
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status: string, order?: Table['current_order']) => {
    if (!order) {
      return {
        label: 'Disponible',
        color: 'bg-green-100 border-green-300 hover:bg-green-50',
        textColor: 'text-green-700',
        icon: CheckCircle
      }
    }

    const readyItems = order.items?.filter(i => 
      i.status?.toLowerCase() === 'ready'
    ).length || 0

    if (readyItems > 0) {
      return {
        label: `${readyItems} listos`,
        color: 'bg-yellow-100 border-yellow-400 hover:bg-yellow-50',
        textColor: 'text-yellow-700',
        icon: AlertCircle
      }
    }

    const preparingItems = order.items?.filter(i => {
      const s = i.status?.toLowerCase()
      return s === 'preparing' || s === 'pending' || s === 'in_kitchen'
    }).length || 0

    if (preparingItems > 0) {
      return {
        label: 'En cocina',
        color: 'bg-blue-100 border-blue-300 hover:bg-blue-50',
        textColor: 'text-blue-700',
        icon: ChefHat
      }
    }

    return {
      label: 'Ocupada',
      color: 'bg-gray-100 border-gray-300 hover:bg-gray-50',
      textColor: 'text-gray-700',
      icon: Clock
    }
  }

  const filteredTables = selectedArea
    ? tables.filter(t => t.area?.id === selectedArea)
    : tables

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'AVAILABLE' && !t.current_order).length,
    occupied: tables.filter(t => t.current_order).length,
    totalSales: tables.reduce((sum, t) => sum + (t.current_order?.total || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Vista de Mesas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Última actualización: {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={fetchTables}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Table2 className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Total Mesas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.available}</p>
                <p className="text-xs text-gray-500">Disponibles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.occupied}</p>
                <p className="text-xs text-gray-500">Ocupadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-900 rounded-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalSales)}</p>
                <p className="text-xs text-gray-500">Ventas Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Area filter */}
      {areas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedArea(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedArea === null
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Todas las áreas
          </button>
          {areas.map(area => (
            <button
              key={area.id}
              onClick={() => setSelectedArea(area.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedArea === area.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {area.name}
            </button>
          ))}
        </div>
      )}

      {/* Tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredTables.map(table => {
          const status = getStatusInfo(table.status, table.current_order)
          const StatusIcon = status.icon
          const hasOrder = !!table.current_order

          return (
            <Link
              key={table.id}
              href={hasOrder 
                ? `/cajero/tomar-pedido/${table.current_order!.id}` 
                : `/cajero/tomar-pedido/nueva?table=${table.id}`
              }
            >
              <Card className={`cursor-pointer transition-all hover:shadow-md border-2 ${status.color}`}>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <StatusIcon className={`h-4 w-4 ${status.textColor}`} />
                    <span className={`text-xs font-medium ${status.textColor}`}>
                      {status.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TableDiningIcon className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{table.name}</h3>
                  </div>
                  
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mt-1">
                    <Users className="h-3 w-3" />
                    <span>{table.capacity}</span>
                  </div>

                  {table.current_order && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(table.current_order.total)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {table.current_order.items?.length || 0} items
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {filteredTables.length === 0 && (
        <div className="text-center py-12">
          <Table2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay mesas en esta área</p>
        </div>
      )}
    </div>
  )
}
