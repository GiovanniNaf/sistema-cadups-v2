'use client'

import { useEffect, useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

interface Paciente {
  id: number
  numero_expediente: string
  nombre: string
  telefono: string
  direccion: string
}

export default function MedicamentosPage() {
  const [pacientesConMedicamentos, setPacientesConMedicamentos] = useState<
    (Paciente & { total_medicamentos: number })[]
  >([])
  const [todosLosPacientes, setTodosLosPacientes] = useState<Paciente[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [nuevo, setNuevo] = useState({
    paciente_id: '',
    nombre_medicamento: '',
    fecha_fin: '',
  })
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const { data: medicamentos, error: medicamentosError } = await supabase
        .from('medicamentos')
        .select('paciente_id')

      if (medicamentosError) return console.error('Error al cargar medicamentos:', medicamentosError)

      const medicamentosPorPaciente: Record<number, number> = {}
      medicamentos?.forEach(({ paciente_id }) => {
        medicamentosPorPaciente[paciente_id] =
          (medicamentosPorPaciente[paciente_id] || 0) + 1
      })

      const pacienteIds = Object.keys(medicamentosPorPaciente).map(Number)

      if (pacienteIds.length > 0) {
        const { data: pacientesData, error: pacientesError } = await supabase
          .from('pacientes')
          .select('*')
          .in('id', pacienteIds)

        if (!pacientesError && pacientesData) {
          const pacientesConConteo = pacientesData.map((p) => ({
            ...p,
            total_medicamentos: medicamentosPorPaciente[p.id] || 0,
          }))
          setPacientesConMedicamentos(pacientesConConteo)
        }
      } else {
        setPacientesConMedicamentos([])
      }

      const { data: allPacientes, error: allError } = await supabase
        .from('pacientes')
        .select('*')
        .order('nombre', { ascending: true })

      if (!allError && allPacientes) {
        setTodosLosPacientes(allPacientes)
      }
    }

    fetchData()
  }, [])

  const asignarMedicamento = async () => {
    const pacienteIdInt = parseInt(nuevo.paciente_id)

    const nuevoMedicamento = {
      paciente_id: pacienteIdInt,
      nombre_medicamento: nuevo.nombre_medicamento,
      fecha_fin: nuevo.fecha_fin,
    }

    const { error } = await supabase.from('medicamentos').insert([nuevoMedicamento])

    if (error) {
      console.error('Error al asignar medicamento:', error)
      toast.error('Hubo un error al guardar el medicamento.')
      return
    }

    toast.success('Medicamento asignado correctamente.')
    setIsOpen(false)
    setNuevo({ paciente_id: '', nombre_medicamento: '', fecha_fin: '' })
    router.refresh()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-8 flex-col sm:flex-row">
        <h1 className="text-3xl font-bold text-gray-800 text-center sm:text-left">
          Pacientes con Medicamentos
        </h1>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium transition mt-4 sm:mt-0"
        >
          + Asignar Medicamento
        </button>
      </div>

      <div className="space-y-4">
        {pacientesConMedicamentos.map((paciente) => (
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
                Medicamentos: <span className="font-medium">{paciente.total_medicamentos}</span>
              </p>
            </div>
            <div className="flex justify-end md:justify-start">
              <button
                onClick={() => router.push(`/dashboard/medicamentos/${paciente.id}`)}
                className="bg-blue-950 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition w-full md:w-auto"
              >
                Ver detalles
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL NUEVO MEDICAMENTO */}
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
              <Dialog.Title className="text-xl font-semibold mb-4">Asignar Medicamento</Dialog.Title>

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Medicamento</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevo.nombre_medicamento}
                    onChange={(e) => setNuevo({ ...nuevo, nombre_medicamento: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Finalización</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={nuevo.fecha_fin}
                    onChange={(e) => setNuevo({ ...nuevo, fecha_fin: e.target.value })}
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
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={asignarMedicamento}
                    disabled={
                      !nuevo.paciente_id || !nuevo.nombre_medicamento.trim() || !nuevo.fecha_fin
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
