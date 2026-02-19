'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Card, CardContent } from '@/components/ui'
import { UtensilsCrossed, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Login simple usando nuestra API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Importante para que las cookies se guarden
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Credenciales incorrectas')
        setIsLoading(false)
        return
      }

      // Guardar sesión en localStorage
      localStorage.setItem('user', JSON.stringify(data.user))
      
      toast.success('¡Bienvenido!')
      
      // Redirigir según el rol usando window.location para forzar recarga completa
      const role = data.user.role
      setTimeout(() => {
        if (role === 'ADMIN') {
          window.location.href = '/admin'
        } else if (role === 'CASHIER') {
          window.location.href = '/cajero'
        } else if (role === 'WAITER') {
          window.location.href = '/mesero'
        } else if (role === 'KITCHEN') {
          window.location.href = '/cocina'
        } else {
          window.location.href = '/'
        }
      }, 100)
    } catch (error: any) {
      toast.error('Error al iniciar sesión')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-600 p-3 rounded-full mb-4">
              <UtensilsCrossed className="h-8 w-8 text-white" />
            </div>
            <div className="bg-amber-100 border border-amber-400 rounded-lg px-4 py-2 mb-3">
              <p className="text-amber-800 text-sm font-semibold text-center">🎯 DEMO - Sistema de Comandas</p>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center">Sistema de Comandas</h1>
            <p className="text-gray-600 mt-1 font-medium">Versión Demostración</p>
            <p className="text-gray-400 text-sm mt-2">Ingresa a tu cuenta</p>
          </div>

          {/* Credenciales Demo */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-xs">
            <p className="font-semibold text-gray-700 mb-2 text-center">Credenciales de prueba:</p>
            <div className="grid grid-cols-2 gap-1 text-gray-600">
              <span className="font-medium">Admin:</span><span>admin@demo.com / admin123</span>
              <span className="font-medium">Cajero:</span><span>cajero@demo.com / cajero123</span>
              <span className="font-medium">Mesero:</span><span>mesero@demo.com / mesero123</span>
              <span className="font-medium">Cocina:</span><span>cocina@demo.com / cocina123</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                label="Contraseña"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              Iniciar Sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
