'use client'

import { useEffect, useState } from 'react'
import PendientesDashboard from '../components/PendientesDashboard'

export default function DashboardPage() {
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const storedUsername = localStorage.getItem('username')
    setUsername(storedUsername)
  }, [])

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold mb-6">
        {username ? `Bienvenido, ${username}` : 'Bienvenido'}
      </h1>
      <PendientesDashboard />
    </main>
  )
}
