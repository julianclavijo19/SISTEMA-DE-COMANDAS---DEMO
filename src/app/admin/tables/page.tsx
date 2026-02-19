'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react'
import { TableDiningIcon } from '@/components/ui/table-dining-icon'
import toast from 'react-hot-toast'
import { TableModal } from '@/components/admin/table-modal'

interface Area {
  id: string
  name: string
}

interface Table {
  id: string
  name: string
  number: number
  capacity: number
  area_id: string
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
  is_active: boolean
  area?: Area
}

const statusLabels: Record<string, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  CLEANING: 'Limpieza',
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)

  useEffect(() => {
    Promise.all([fetchTables(), fetchAreas()])
  }, [])

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables')
      const data = await res.json()
      setTables(data)
    } catch (error) {
      toast.error('Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }

  const fetchAreas = async () => {
    try {
      const res = await fetch('/api/areas')
      const data = await res.json()
      setAreas(data)
    } catch (error) {
      console.error('Error fetching areas:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Esta seguro de eliminar esta mesa?')) return

    try {
      const res = await fetch(`/api/tables/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Mesa eliminada')
        fetchTables()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error al eliminar mesa')
    }
  }

  const handleStatusChange = async (table: Table, newStatus: string) => {
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...table, status: newStatus }),
      })
      if (res.ok) {
        toast.success('Estado actualizado')
        fetchTables()
      }
    } catch (error) {
      toast.error('Error al actualizar')
    }
  }

  const handleEdit = (table: Table) => {
    setSelectedTable(table)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setSelectedTable(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedTable(null)
  }

  const handleSave = () => {
    fetchTables()
    handleModalClose()
  }

  const filteredTables = tables.filter((table) => {
    const matchesSearch = table.name.toLowerCase().includes(search.toLowerCase()) ||
      table.number.toString().includes(search)
    const matchesArea = !filterArea || table.area_id === filterArea
    const matchesStatus = !filterStatus || table.status === filterStatus
    return matchesSearch && matchesArea && matchesStatus
  })

  const tablesByStatus = {
    FREE: tables.filter(t => t.status === 'FREE').length,
    OCCUPIED: tables.filter(t => t.status === 'OCCUPIED').length,
    RESERVED: tables.filter(t => t.status === 'RESERVED').length,
    CLEANING: tables.filter(t => t.status === 'CLEANING').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mesas</h1>
          <p className="text-sm text-gray-500 mt-1">Configuracion de mesas del restaurante</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Mesa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Libres</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{tablesByStatus.FREE}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Ocupadas</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{tablesByStatus.OCCUPIED}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Reservadas</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{tablesByStatus.RESERVED}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Limpieza</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{tablesByStatus.CLEANING}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o numero..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            <option value="">Todas las areas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            <option value="">Todos los estados</option>
            <option value="FREE">Libre</option>
            <option value="OCCUPIED">Ocupada</option>
            <option value="RESERVED">Reservada</option>
            <option value="CLEANING">Limpieza</option>
          </select>
        </div>
      </div>

      {/* Tables List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mesa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTables.map((table) => (
                <tr key={table.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <TableDiningIcon className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{table.name}</p>
                        <p className="text-xs text-gray-500">#{table.number}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">{table.area?.name || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>{table.capacity}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={table.status}
                      onChange={(e) => handleStatusChange(table, e.target.value)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border-0 cursor-pointer ${
                        table.status === 'FREE' ? 'bg-gray-100 text-gray-700' :
                        table.status === 'OCCUPIED' ? 'bg-gray-900 text-white' :
                        table.status === 'RESERVED' ? 'bg-gray-700 text-white' :
                        'bg-gray-300 text-gray-700'
                      }`}
                    >
                      <option value="FREE">Libre</option>
                      <option value="OCCUPIED">Ocupada</option>
                      <option value="RESERVED">Reservada</option>
                      <option value="CLEANING">Limpieza</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(table)}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(table.id)}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTables.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No se encontraron mesas</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <TableModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        table={selectedTable}
        areas={areas}
      />
    </div>
  )
}
