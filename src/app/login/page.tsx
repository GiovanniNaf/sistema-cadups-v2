'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'  // Importa tu cliente Supabase
import { useRouter } from 'next/navigation'  // Para manejar el redireccionamiento a otras rutas

export default function Login() {
  const [form, setForm] = useState({
    username: '',
    password: ''
  })
  const [error, setError] = useState('')  // Para mostrar el error de credenciales incorrectas
  const router = useRouter()  // Usamos router para redirigir a otras páginas

  const handleLogin = async (e: { preventDefault: () => void }) => {
    e.preventDefault()  // Evitar el comportamiento por defecto de recargar la página

    // Consultamos la base de datos en Supabase para verificar las credenciales
    const { data, error: supabaseError } = await supabase
      .from('users')  // Nombre de la tabla de usuarios
      .select('*')
      .eq('username', form.username)
      .eq('password', form.password)

    // Verificamos si hubo un error en la consulta
    if (supabaseError) {
      setError('Error en la consulta, intente de nuevo.')
      return
    }

    if (data && data.length > 0) {
      const user = data[0]
      // Guardamos un token en localStorage al momento de un login exitoso
      localStorage.setItem('token', 'true')  // O un token JWT si lo estás utilizando
      localStorage.setItem('username', user.username) 
      router.push('/dashboard')  // Redirigimos al Dashboard
    } else {
      setError('Credenciales incorrectas')
    }
  }

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
        <h2 className="text-2xl font-bold text-center mb-6">Iniciar sesión</h2>
        
        {/* Mostrar error si las credenciales son incorrectas */}
        {error && <p className="text-red-500 text-center">{error}</p>}
        
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2" htmlFor="username">
              Nombre de usuario
            </label>
            <input
              id="username"
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded-md"
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
