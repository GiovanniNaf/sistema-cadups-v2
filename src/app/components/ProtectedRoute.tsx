'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.push('/login')  // Si no hay token, redirigimos al login
    } else {
      setIsAuthenticated(true)  // Si hay token, el usuario está autenticado
    }

    setLoading(false)
  }, [router])

  if (loading) return <div>Loading...</div>  // Mientras se carga la verificación
  if (!isAuthenticated) return null  // Si no está autenticado, no se muestra nada

  return <>{children}</>  // Si está autenticado, se renderiza el contenido
}
