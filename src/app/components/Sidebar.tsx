'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useState } from 'react'
import { Menu, X, Home, ClipboardList, Pill, CalendarDays, LogOut, User2Icon, BriefcaseIcon, BanknoteArrowDownIcon } from 'lucide-react'


const links = [
  { href: '/dashboard/', label: 'Inicio', icon: Home },
  { href: '/dashboard/pacientes', label: 'Pacientes', icon: User2Icon },
  { href: '/dashboard/interconsultas', label: 'Interconsultas', icon: ClipboardList },
  { href: '/dashboard/medicamentos', label: 'Medicamentos', icon: Pill },
  { href: '/dashboard/visitas', label: 'Visitas', icon: CalendarDays },
  { href: '/dashboard/caja', label: 'Tienda', icon: BriefcaseIcon  },
    { href: '/dashboard/personales', label: 'Personales', icon:BanknoteArrowDownIcon  },
 
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex-1"> {/* Este div ocupará todo el espacio disponible */}
        <div className="p-4 text-2xl font-bold border-b border-gray-700">Control UPS</div>
        <nav className="p-4 space-y-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/dashboard/'
              ? pathname === '/dashboard' || pathname === '/dashboard/'
              : pathname.startsWith(href)
  
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={clsx(
                  'flex items-center px-3 py-2 rounded hover:bg-gray-800 transition',
                  isActive && 'bg-gray-800'
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {label}
              </Link>
            )
          })}
          {/* Botón de cerrar sesión movido aquí */}
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 mt-2 bg-red-600 hover:bg-red-700 rounded transition"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar sesión
          </button>
        </nav>
      </div>
    </div>
  )

  return (
    <>
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex fixed top-0 left-0 w-64 h-screen bg-gray-900 text-white z-40">
        {SidebarContent}
      </aside>

      {/* Toggle Button Mobile */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setOpen(true)}
          className="text-white bg-gray-900 p-2 rounded-md"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
          <div className="w-64 bg-gray-900 h-full p-4 text-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold">Control UPS</span>
              <button onClick={() => setOpen(false)}>
                <X size={24} />
              </button>
            </div>
            {SidebarContent}
          </div>
        </div>
      )}
    </>
  )
}