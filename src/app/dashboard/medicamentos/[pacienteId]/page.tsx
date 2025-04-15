'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

interface Medicamento {
  id: number
  paciente_id: number
  nombre_medicamento: string
  fecha_fin: string
}

export default function MedicamentosPage() {
  const { pacienteId } = useParams()
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [modalActivo, setModalActivo] = useState(false)
  const [medicamentoActual, setMedicamentoActual] = useState<Medicamento | null>(null)
  const [nuevaFin, setNuevaFin] = useState('')

  useEffect(() => {
    const fetchMedicamentos = async () => {
      const { data, error } = await supabase
        .from('medicamentos')
        .select('*')
        .eq('paciente_id', pacienteId)

      if (!error && data) {
        setMedicamentos(data)
      }
    }

    fetchMedicamentos()
  }, [pacienteId])

  const calcularDiasRestantes = (fechaFin: string) => {
    const hoy = new Date()
    const fin = new Date(fechaFin)
    const diffMs = fin.getTime() - hoy.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }


  const formatFecha = (fecha: string) => {
    return new Date(fecha)
      .toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'  // Fuerza UTC en el formateo
      });
  }

  const eliminarMedicamento = async (id: number) => {
    await supabase.from('medicamentos').delete().eq('id', id)
    setMedicamentos(medicamentos.filter((m) => m.id !== id))
    toast.success('Medicamento eliminado')
  }

  const abrirModalResurtir = (medicamento: Medicamento) => {
    setMedicamentoActual(medicamento)
    setNuevaFin(medicamento.fecha_fin)
    setModalActivo(true)
  }

  const guardarResurtido = async () => {
    if (!medicamentoActual) return

    const { error } = await supabase
      .from('medicamentos')
      .update({ fecha_fin: nuevaFin })
      .eq('id', medicamentoActual.id)

    if (!error) {
      const actualizados = medicamentos.map((m) =>
        m.id === medicamentoActual.id
          ? { ...m, fecha_fin: nuevaFin }
          : m
      )
      setMedicamentos(actualizados)
      setModalActivo(false)
      setMedicamentoActual(null)
      toast.success('Fecha actualizada')
    } else {
      toast.error('Error al actualizar')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Toaster position="top-right" />
      <h1 className="text-2xl font-bold text-center mb-8 text-blue-950">
        Medicamentos asignados
      </h1>

      {medicamentos.length === 0 ? (
        <div className="text-center text-gray-500">No hay medicamentos asignados.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {medicamentos.map((medicamento) => {
            const diasRestantes = calcularDiasRestantes(medicamento.fecha_fin)
            const terminaPronto = diasRestantes <= 3

            return (
              <div
                key={medicamento.id}
                className={`rounded-2xl shadow-md p-6 bg-white border-l-4 transition-all ${
                  terminaPronto ? 'border-red-500 bg-red-50/50' : 'border-blue-400 bg-blue-50/30'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold text-blue-900">{medicamento.nombre_medicamento}</h2>
                  {terminaPronto && (
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-lg">
                      Termina pronto
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Fin:</span> {formatFecha(medicamento.fecha_fin)}
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  <span className="font-medium">Días restantes:</span>{' '}
                  <span className={terminaPronto ? 'text-red-600 font-semibold' : ''}>
                    {diasRestantes}
                  </span>
                </p>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => eliminarMedicamento(medicamento.id)}
                    className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => abrirModalResurtir(medicamento)}
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    Resurtir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL */}
      {modalActivo && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Resurtir {medicamentoActual?.nombre_medicamento}
            </h3>
            <div className="flex flex-col gap-4">
              <label className="text-sm text-gray-700">
                Nueva fecha de fin:
                <input
                  type="date"
                  value={nuevaFin}
                  onChange={(e) => setNuevaFin(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalActivo(false)}
                className="px-4 py-2 rounded-md text-sm bg-gray-300 hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={guardarResurtido}
                className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
