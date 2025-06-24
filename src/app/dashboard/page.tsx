// app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { withAuth } from '../components/withAuth'
import PendientesDashboard from '../components/PendientesDashboard'

function DashboardPage() {
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

export default withAuth(DashboardPage)