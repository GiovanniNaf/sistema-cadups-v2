'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Verifica si el usuario tiene un token de autenticación
    const token = localStorage.getItem('token')

    if (token) {
      // Si el token existe, redirige al Dashboard
      router.push('/dashboard')
    } else {
      // Si no hay token, redirige al login
      router.push('/login')
    }
  }, [router])

  return (
    <div className="h-screen flex justify-center items-center">
      <p>Redirigiendo...</p>
    </div>
  )
}
