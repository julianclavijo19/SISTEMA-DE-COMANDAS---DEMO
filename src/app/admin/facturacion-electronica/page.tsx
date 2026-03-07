'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import {
  FileText, Search, Download, Eye, RefreshCw,
  ChevronLeft, ChevronRight, ExternalLink, AlertCircle,
  CheckCircle, Clock, X
} from 'lucide-react'
import toast from 'react-hot-toast'

interface FactusBill {
  id: number
  number: string
  reference_code: string
  identification: string
  graphic_representation_name: string
  names: string
  company: string | null
  email: string
  total: string
  status: number
  created_at: string
  payment_form: { code: string; name: string }
  credit_notes: any[]
  debit_notes: any[]
  errors: Record<string, string> | null
}

interface Pagination {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

export default function FacturacionElectronicaPage() {
  const [bills, setBills] = useState<FactusBill[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'number' | 'identification'>('number')
  const [selectedBill, setSelectedBill] = useState<FactusBill | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchBills = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (searchQuery) {
        params.append(searchType, searchQuery)
      }
      const res = await fetch(`/api/facturacion?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setBills(data.data || [])
        setPagination(data.pagination || null)
      } else {
        toast.error('Error al cargar facturas electrónicas')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, searchType])

  useEffect(() => {
    fetchBills(currentPage)
  }, [currentPage, fetchBills])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchBills(1)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setCurrentPage(1)
    fetchBills(1)
  }

  const handleDownloadPDF = async (billNumber: string) => {
    setDownloading(billNumber)
    try {
      const res = await fetch(`/api/facturacion/${billNumber}/pdf`)
      if (res.ok) {
        const data = await res.json()
        if (data.pdf) {
          const link = document.createElement('a')
          link.href = `data:application/pdf;base64,${data.pdf}`
          link.download = `${billNumber}.pdf`
          link.click()
          toast.success('PDF descargado')
        } else {
          toast.error('PDF no disponible')
        }
      } else {
        toast.error('Error al descargar PDF')
      }
    } catch (error) {
      toast.error('Error al descargar PDF')
    } finally {
      setDownloading(null)
    }
  }

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">
            <CheckCircle className="h-3 w-3" />
            Validada
          </span>
        )
      case 0:
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-yellow-50 text-yellow-700">
            <Clock className="h-3 w-3" />
            Pendiente
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            <AlertCircle className="h-3 w-3" />
            Estado {status}
          </span>
        )
    }
  }

  if (loading && bills.length === 0) {
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
          <h1 className="text-2xl font-semibold text-gray-900">Facturación Electrónica</h1>
          <p className="text-gray-500 text-sm mt-1">
            Facturas emitidas ante la DIAN
            {pagination && ` - ${pagination.total} registros`}
          </p>
        </div>
        <Button
          onClick={() => fetchBills(currentPage)}
          variant="outline"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as 'number' | 'identification')}
          className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
        >
          <option value="number">Buscar por número</option>
          <option value="identification">Buscar por identificación</option>
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={searchType === 'number' ? 'Número de factura...' : 'NIT o cédula del cliente...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <Button onClick={handleSearch} className="bg-gray-900 hover:bg-gray-800 text-white">
          Buscar
        </Button>
        {searchQuery && (
          <Button variant="outline" onClick={handleClearSearch}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Bills list */}
      <Card>
        <CardContent className="p-0">
          {bills.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No hay facturas electrónicas</p>
            </div>
          ) : (
            <div className="divide-y">
              {bills.map(bill => (
                <div key={bill.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                        <FileText className="h-5 w-5 text-gray-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{bill.number}</span>
                          {getStatusBadge(bill.status)}
                          {bill.credit_notes?.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600">
                              Con nota crédito
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {bill.graphic_representation_name || bill.names || 'Consumidor Final'}
                          {bill.identification && ` - ${bill.identification}`}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>{bill.created_at}</span>
                          <span>{bill.payment_form?.name}</span>
                          {bill.reference_code && (
                            <span className="text-gray-300">Ref: {bill.reference_code}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <span className="text-lg font-semibold">
                        {formatCurrency(parseFloat(bill.total))}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDownloadPDF(bill.number)}
                          disabled={downloading === bill.number}
                          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                          title="Descargar PDF"
                        >
                          <Download className={`h-4 w-4 text-gray-600 ${downloading === bill.number ? 'animate-pulse' : ''}`} />
                        </button>
                        <button
                          onClick={() => setSelectedBill(selectedBill?.id === bill.id ? null : bill)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {selectedBill?.id === bill.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block">Tipo documento</span>
                          <span className="font-medium">Factura Electrónica</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Forma de pago</span>
                          <span className="font-medium">{bill.payment_form?.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Estado DIAN</span>
                          <span className="font-medium">{bill.status === 1 ? 'Validada' : 'Pendiente'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Cliente</span>
                          <span className="font-medium">{bill.graphic_representation_name || 'Consumidor Final'}</span>
                        </div>
                      </div>
                      {bill.errors && Object.keys(bill.errors).length > 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                          <p className="text-xs font-medium text-yellow-800 mb-1">Notificaciones DIAN:</p>
                          {Object.entries(bill.errors).map(([code, msg]) => (
                            <p key={code} className="text-xs text-yellow-700">{msg}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {pagination.current_page} de {pagination.last_page}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= (pagination.last_page || 1)}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
