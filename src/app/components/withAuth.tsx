// components/withAuth.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ComponentType, JSX } from 'react'

export function withAuth<P extends JSX.IntrinsicAttributes>(
  WrappedComponent: ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const router = useRouter()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
      } else {
        setIsAuthenticated(true)
      }
      setIsLoading(false)
    }, [router])

    if (isLoading) {
      return (
        <div className="h-screen flex justify-center items-center">
          <p>Verificando acceso...</p>
        </div>
      )
    }

    return isAuthenticated ? <WrappedComponent {...props} /> : null
  }
}
