'use client'

import { useEffect, useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast' // Importación agregada
import { withAuth } from '@/app/components/withAuth'

interface Paciente {
  id: number
  numero_expediente: string
  nombre: string
  telefono: string
  direccion: string
}

const ESPECIALISTAS = [
  "Psiquiatría",
  "Odontología",
  "Fisioterapía",
  "Internista",
  "Ginecología",
  "Otros"
]

function InterconsultaPage() {
  const [pacientesConInterconsultas, setPacientesConInterconsultas] = useState<
    (Paciente & { total_interconsultas: number })[]
  >([])
  const [todosLosPacientes, setTodosLosPacientes] = useState<Paciente[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [nuevo, setNuevo] = useState({
    paciente_id: '',
    fecha: '',
    observacion: '',
    especialista: ''
  })
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const { data: interconsultas, error: interconsultaError } = await supabase
        .from('interconsultas')
        .select('paciente_id')

      if (interconsultaError) {
        console.error('Error al cargar interconsultas:', interconsultaError)
        toast.error('Error al cargar interconsultas') // Notificación agregada
        return
      }

      const interconsultasPorPaciente: Record<number, number> = {}
      interconsultas?.forEach(({ paciente_id }) => {
        interconsultasPorPaciente[paciente_id] =
          (interconsultasPorPaciente[paciente_id] || 0) + 1
      })

      const pacienteIds = Object.keys(interconsultasPorPaciente).map(Number)

      if (pacienteIds.length > 0) {
        const { data: pacientesData, error: pacientesError } = await supabase
          .from('pacientes')
          .select('*')
          .in('id', pacienteIds)

        if (pacientesError) {
          console.error('Error al cargar pacientes:', pacientesError)
          toast.error('Error al cargar pacientes') // Notificación agregada
        } else if (pacientesData) {
          const pacientesConConteo = pacientesData.map((p) => ({
            ...p,
            total_interconsultas: interconsultasPorPaciente[p.id] || 0,
          }))
          setPacientesConInterconsultas(pacientesConConteo)
        }
      } else {
        setPacientesConInterconsultas([])
      }

      const { data: allPacientes, error: allError } = await supabase
        .from('pacientes')
        .select('*')
        .order('nombre', { ascending: true })

      if (allError) {
        console.error('Error al cargar todos los pacientes:', allError)
        toast.error('Error al cargar pacientes') // Notificación agregada
      } else if (allPacientes) {
        setTodosLosPacientes(allPacientes)
      }
    }

    fetchData()
  }, [])

  const crearInterconsulta = async () => {
    if (!nuevo.especialista) {
      toast.error('Por favor seleccione un especialista') // Notificación modificada
      return
    }

    try {
      const { error } = await supabase.from('interconsultas').insert([nuevo])
      if (error) throw error

      setIsOpen(false)
      setNuevo({ paciente_id: '', fecha: '', observacion: '', especialista: '' })
      toast.success('Interconsulta creada exitosamente') // Notificación agregada
      router.refresh()
    } catch (error) {
      console.error('Error al crear interconsulta:', error)
      toast.error('Error al crear interconsulta') // Notificación agregada
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Componente Toaster agregado */}
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-8 flex-col sm:flex-row">
        <h1 className="text-3xl font-bold text-gray-800 text-center sm:text-left">
          Pacientes con Interconsultas
        </h1>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg font-medium transition mt-4 sm:mt-0"
        >
          + Nueva Interconsulta
        </button>
      </div>

      {/* Resto del código permanece igual */}
      <div className="space-y-4">
        {pacientesConInterconsultas.map((paciente) => (
          <div
            key={paciente.id}
            className="bg-white p-4 md:p-6 rounded-xl shadow-md hover:shadow-lg transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="space-y-1">
              <p className="text-lg md:text-xl font-semibold text-gray-900">{paciente.nombre}</p>
              <p className="text-sm text-gray-600">
                Expediente: <span className="font-medium">{paciente.numero_expediente}</span>
              </p>
              <p className="text-sm text-gray-600">
                Interconsultas: <span className="font-medium">{paciente.total_interconsultas}</span>
              </p>
            </div>
            <div className="flex justify-end md:justify-start">
              <button
                onClick={() => router.push(`/dashboard/interconsultas/${paciente.id}`)}
                className="bg-blue-950 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition w-full md:w-auto"
              >
                Ver detalles
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL NUEVA INTERCONSULTA */}
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setIsOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 backdrop-blur-sm bg-black/30" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-white w-full max-w-md rounded-xl shadow-lg p-6">
              <Dialog.Title className="text-xl font-semibold mb-4">Nueva Interconsulta</Dialog.Title>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevo.paciente_id}
                    onChange={(e) => setNuevo({ ...nuevo, paciente_id: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    {todosLosPacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Especialista</label>
  <div className="flex flex-col gap-2">
    <select
      className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
      value={nuevo.especialista === '' ? 'Otros' : 
             ESPECIALISTAS.includes(nuevo.especialista) ? nuevo.especialista : 'Otros'}
      onChange={(e) => {
        if (e.target.value !== 'Otros') {
          setNuevo({ ...nuevo, especialista: e.target.value })
        } else {
          setNuevo({ ...nuevo, especialista: '' })
        }
      }}
    >
      <option value="">Seleccionar especialista...</option>
      {ESPECIALISTAS.map((esp) => (
        <option key={esp} value={esp}>{esp}</option>
      ))}
    </select>
    
    {(nuevo.especialista === '' || !ESPECIALISTAS.includes(nuevo.especialista)) && (
      <input
        type="text"
        className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
        placeholder="Especificar especialista"
        value={nuevo.especialista === '' ? '' : 
               !ESPECIALISTAS.includes(nuevo.especialista) ? nuevo.especialista : ''}
        onChange={(e) => setNuevo({ ...nuevo, especialista: e.target.value })}
      />
    )}
  </div>
</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevo.fecha}
                    onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
                  <textarea
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevo.observacion}
                    onChange={(e) => setNuevo({ ...nuevo, observacion: e.target.value })}
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 text-gray-600 hover:underline"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={crearInterconsulta}
                    disabled={
                      !nuevo.paciente_id ||
                      !nuevo.fecha ||
                      !nuevo.observacion.trim() ||
                      !nuevo.especialista.trim()
                    }
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}

export default withAuth(InterconsultaPage);