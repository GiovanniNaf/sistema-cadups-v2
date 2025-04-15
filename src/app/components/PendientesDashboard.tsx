'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/20/solid'
import { Dialog } from '@headlessui/react'

interface Interconsulta {
  id: number
  paciente_id: number
  fecha: string
  observacion: string | null
  completada: boolean
  siguiente_fecha: string | null
}

interface Medicamento {
  id: number
  paciente_id: number
  nombre_medicamento: string
  fecha_fin: string
}

interface Paciente {
  id: number
  nombre: string
}

export default function Dashboard() {
  const [interconsultas, setInterconsultas] = useState<Interconsulta[]>([])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)

  const [formId, setFormId] = useState<number | null>(null)
  const [formType, setFormType] = useState<'completar' | 'nueva' | null>(null)
  const [observacion, setObservacion] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: interData }, { data: medData }, { data: pacData }] = await Promise.all([
        supabase.from('interconsultas').select('*').eq('completada', false).order('fecha', { ascending: true }),
        supabase.from('medicamentos').select('*').gte('fecha_fin', new Date().toISOString()).order('fecha_fin'),
        supabase.from('pacientes').select('id, nombre')
      ])

      setInterconsultas(interData || [])
      setMedicamentos(medData || [])
      setPacientes(pacData || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const openForm = (id: number, type: 'completar' | 'nueva') => {
    setFormId(id)
    setFormType(type)
    setObservacion('')
    setNuevaFecha('')
    setIsOpen(true)
  }

  const closeModal = () => {
    setFormId(null)
    setFormType(null)
    setObservacion('')
    setNuevaFecha('')
    setIsOpen(false)
  }

  const handleSubmitCompletar = async () => {
    if (!formId) return
    await supabase
      .from('interconsultas')
      .update({ completada: true, observacion })
      .eq('id', formId)

    setInterconsultas(prev => prev.filter(item => item.id !== formId))
    closeModal()
  }

  const handleSubmitNueva = async () => {
    const interconsulta = interconsultas.find(i => i.id === formId)
    if (!interconsulta || !nuevaFecha) return

    await supabase
    .from('interconsultas')
    .update({ completada: true, observacion })
    .eq('id', interconsulta.id)
  
  await supabase
    .from('interconsultas')
    .insert({
      paciente_id: interconsulta.paciente_id,
      fecha: nuevaFecha,
      observacion: null // o '', si prefieres dejar vacío
    })
  
    

    setInterconsultas(prev => prev.filter(item => item.id !== interconsulta.id))
    closeModal()
  }

  const getNombrePaciente = (id: number) => {
    return pacientes.find(p => p.id === id)?.nombre || 'Desconocido'
  }

  const calcularDiasRestantes = (fechaFin: string) => {
    const hoy = new Date()
    const fechaFinal = new Date(fechaFin)
    const diffTime = fechaFinal.getTime() - hoy.getTime()
    return Math.ceil(diffTime / (1000 * 3600 * 24))
  }

  const formatDate = (fecha: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
    const date = new Date(fecha)
    return new Intl.DateTimeFormat('es-ES', options).format(date)
  }

  if (loading) return <p className="text-center text-gray-500 p-6">Cargando datos...</p>

return (
  <div className="space-y-10 w-full max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Tareas Pendientes</h1>

    {/* INTERCONSULTAS */}
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-yellow-700 mb-4">Interconsultas Pendientes</h2>
      {interconsultas.length === 0 ? (
        <p className="text-gray-500">No hay interconsultas pendientes.</p>
      ) : (
        <div className="space-y-4">
          {interconsultas.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg shadow bg-yellow-50 border-l-4 border-yellow-400 hover:shadow-md transition"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <ExclamationCircleIcon className="h-6 w-6 text-yellow-600" />
                  <p className="text-base sm:text-lg font-medium">{getNombrePaciente(item.paciente_id)}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => openForm(item.id, 'completar')}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    Marcar completada
                  </button>
                  <button
                    onClick={() => openForm(item.id, 'nueva')}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Agendar nueva
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2"><strong>Fecha:</strong> {formatDate(item.fecha)}</p>
              <p className="text-sm text-gray-600"><strong>Observación:</strong> {item.observacion || 'Ninguna'}</p>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* MEDICAMENTOS */}
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-orange-700 mb-4">Medicamentos por Finalizar</h2>
      {medicamentos.length === 0 ? (
        <p className="text-gray-500">No hay medicamentos próximos a finalizar.</p>
      ) : (
        <div className="space-y-4">
          {medicamentos.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg shadow bg-orange-50 border-l-4 border-orange-400 hover:shadow-md transition"
            >
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
                <p className="text-base sm:text-lg font-medium">{getNombrePaciente(item.paciente_id)}</p>
              </div>
              <p className="text-sm text-gray-600 mt-2"><strong>Medicamento:</strong> {item.nombre_medicamento}</p>
              <p className="text-sm text-gray-600">
                <strong>Días restantes:</strong> {calcularDiasRestantes(item.fecha_fin)} días
              </p>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* MODAL */}
    <Dialog open={isOpen} onClose={closeModal} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <Dialog.Panel className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4 relative">
          <button onClick={closeModal} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
          <Dialog.Title className="text-lg font-semibold text-gray-800">
            {formType === 'completar' ? 'Marcar como completada' : 'Agendar nueva interconsulta'}
          </Dialog.Title>

          {formType === 'nueva' && (
            <input
              type="date"
              className="w-full border border-gray-300 rounded p-2 text-sm"
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
            />
          )}
          <textarea
            className="w-full border border-gray-300 rounded p-2 text-sm"
            rows={3}
            placeholder="Observaciones..."
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={closeModal}
              className="text-gray-600 text-sm hover:underline"
            >
              Cancelar
            </button>
            <button
              onClick={formType === 'completar' ? handleSubmitCompletar : handleSubmitNueva}
              className={`text-white px-4 py-1.5 rounded text-sm ${
                formType === 'completar' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {formType === 'completar' ? 'Confirmar' : 'Agendar'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  </div>
)
}