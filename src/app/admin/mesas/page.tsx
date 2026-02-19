'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui'
import { formatCurrency, getTimeDifference } from '@/lib/utils'
import { 
  Users, Clock, Search, RefreshCw, Timer
} from 'lucide-react'
import { TableDiningIcon } from '@/components/ui/table-dining-icon'

interface Table {
  id: string
  name: string
  capacity: number
  status: string
  area: { name: string } | null
  waiter?: { id: string; name: string } | null
  current_order?: {
    id: string
    order_number: string
    status: string
    total: number
    created_at: string
    items_count: number
    ready_items: number
  } | null
}

interface Area {
  id: string
  name: string
  tables: Table[]
}

export default function MesasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/mesero/mesas')
      if (res.ok) {
        const data = await res.json()
        setAreas(data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTables()
    const interval = setInterval(fetchTables, 5000)
    return () => clearInterval(interval)
  }, [fetchTables])

  const statusConfig: Record<string, { label: string; dotColor: string }> = {
    FREE: { label: 'Disponible', dotColor: 'bg-green-500' },
    AVAILABLE: { label: 'Disponible', dotColor: 'bg-green-500' },
    OCCUPIED: { label: 'Ocupada', dotColor: 'bg-gray-900' },
    RESERVED: { label: 'Reservada', dotColor: 'bg-yellow-500' },
    CLEANING: { label: 'Limpiando', dotColor: 'bg-gray-400' },
    MAINTENANCE: { label: 'Mantenimiento', dotColor: 'bg-gray-400' },
  }

  const orderStatusLabels: Record<string, string> = {
    PENDING: 'Pendiente',
    IN_KITCHEN: 'En cocina',
    READY: 'Listo',
    SERVED: 'Servido',
  }

  const filteredAreas = areas.map(area => ({
    ...area,
    tables: area.tables.filter(table => {
      if (searchQuery && !table.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (filter === 'available' && !['FREE', 'AVAILABLE'].includes(table.status)) {
        return false
      }
      if (filter === 'occupied' && table.status !== 'OCCUPIED') {
        return false
      }
      return true
    })
  })).filter(area => area.tables.length > 0)

  const stats = {
    available: areas.flatMap(a => a.tables).filter(t => ['FREE', 'AVAILABLE'].includes(t.status)).length,
    occupied: areas.flatMap(a => a.tables).filter(t => t.status === 'OCCUPIED').length,
    ordersReady: areas.flatMap(a => a.tables).filter(t => t.current_order?.status === 'READY').length,
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Estado de Mesas</h1>
          <p className="text-gray-500 text-sm mt-1">Vista en tiempo real del estado de las mesas</p>
        </div>
        
        <button 
          onClick={fetchTables}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Disponibles</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Ocupadas</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.occupied}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Listos para servir</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.ordersReady}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar mesa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'available', 'occupied'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'available' ? 'Disponibles' : 'Ocupadas'}
            </button>
          ))}
        </div>
      </div>

      {filteredAreas.map((area) => (
        <div key={area.id}>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            {area.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {area.tables.map((table) => {
              const config = statusConfig[table.status] || statusConfig.AVAILABLE
              const isReady = table.current_order?.status === 'READY'

              return (
                <div
                  key={table.id}
                  className={`${
                    table.status === 'MAINTENANCE' ? 'opacity-50' : ''
                  }`}
                >
                  <Card className={`${isReady ? 'ring-2 ring-gray-900' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <TableDiningIcon className="w-4.5 h-4.5 text-blue-500" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">{table.name}</h3>
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                      </div>
                      
                      <div className="flex items-center gap-1 text-gray-500 text-sm">
                        <Users className="h-4 w-4" />
                        <span>{table.capacity}</span>
                      </div>

                      <p className="text-xs text-gray-500 mt-2">{config.label}</p>

                      {table.status === 'OCCUPIED' && table.current_order && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                          {table.waiter && (
                            <p className="text-xs font-medium text-gray-700 truncate">
                              👤 {table.waiter.name}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                              {orderStatusLabels[table.current_order.status]}
                            </span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(table.current_order.total)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Timer className="h-3 w-3" />
                            <span>{getTimeDifference(table.current_order.created_at)}</span>
                          </div>
                        </div>
                      )}

                      {['FREE', 'AVAILABLE'].includes(table.status) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-500">
                            Sin pedido activo
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {filteredAreas.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">
              {searchQuery ? 'No se encontraron mesas' : 'No hay mesas configuradas'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
