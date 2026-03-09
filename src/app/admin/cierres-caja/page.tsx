'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { Calendar, RefreshCw, Wallet } from 'lucide-react'

interface CashRegister {
  id: string
  user?: { name: string; email: string } | null
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference: number | null
  cash_sales: number
  card_sales: number
  transfer_sales: number
  total_sales: number
  total_orders: number
  tips: number
  status: string
  opened_at: string
  closed_at: string | null
}

export default function CierresCajaPage() {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date()
    date.setDate(1) // Primer día del mes
    return date.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  const fetchRegisters = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cajero/historial-caja?from=${dateFrom}&to=${dateTo}`)
      if (res.ok) {
        const data = await res.json()
        setRegisters(data.registers || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchRegisters()
  }, [fetchRegisters])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getDifferenceColor = (diff: number | null) => {
    if (diff === null || diff === 0) return 'text-gray-600'
    if (diff > 0) return 'text-green-600'
    return 'text-red-600'
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cierres de Caja</h1>
          <p className="text-gray-500 text-sm mt-1">
            Historial de cierres y arqueos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button 
            onClick={fetchRegisters}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {registers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-900 font-medium">No hay cierres de caja</p>
            <p className="text-gray-500 text-sm mt-1">No se encontraron registros para este periodo</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Responsable</th>
                    <th className="px-4 py-3 font-medium text-right">Ventas</th>
                    <th className="px-4 py-3 font-medium text-right">Base</th>
                    <th className="px-4 py-3 font-medium text-right">Efectivo</th>
                    <th className="px-4 py-3 font-medium text-right">Tarjeta</th>
                    <th className="px-4 py-3 font-medium text-right">Transferencia</th>
                    <th className="px-4 py-3 font-medium text-right">Esperado Caja</th>
                    <th className="px-4 py-3 font-medium text-right">Conteo Cierre</th>
                    <th className="px-4 py-3 font-medium text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registers.map((register, index) => {
                    return (
                      <tr key={register.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {registers.length - index}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {formatDate(register.opened_at)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTime(register.opened_at)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {register.user?.name || register.user?.email || 'Desconocido'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(register.total_sales)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {formatCurrency(register.opening_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {formatCurrency(register.cash_sales)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {formatCurrency(register.card_sales)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">
                          {formatCurrency(register.transfer_sales)}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 text-right font-semibold">
                          {formatCurrency(Number(register.opening_amount || 0) + Number(register.cash_sales || 0))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {register.closing_amount !== null ? (
                            <span className="text-gray-900">{formatCurrency(register.closing_amount)}</span>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Abierta</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${getDifferenceColor(register.difference)}`}>
                          {register.difference !== null ? (
                            <>
                              {register.difference >= 0 ? '+' : ''}{formatCurrency(register.difference)}
                            </>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
