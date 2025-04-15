import Sidebar from '../components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 bg-gray-100 p-6 overflow-y-auto max-h-screen">
        {children}
      </main>
    </div>
  )
}
