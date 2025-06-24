'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { withAuth } from '@/app/components/withAuth'

interface Medicamento {
  id: number
  paciente_id: number
  nombre_medicamento: string
  fecha_fin: string
  fecha_compra: string
  precio?: number
  estado?: boolean
}

function MedicamentosPage() {
  const { pacienteId } = useParams()
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [modalActivo, setModalActivo] = useState(false)
  const [modalEditarActivo, setModalEditarActivo] = useState(false)
  const [medicamentoActual, setMedicamentoActual] = useState<Medicamento | null>(null)
  const [formMedicamento, setFormMedicamento] = useState<Medicamento | null>(null)
  const [nuevaFin, setNuevaFin] = useState('')
  const [nuevaCompra, setNuevaCompra] = useState('')
  const [estadoResurtido, setEstadoResurtido] = useState(false)

  useEffect(() => {
    const fetchMedicamentos = async () => {
      const { data, error } = await supabase
        .from('medicamentos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha_fin', { ascending: true })

      if (!error && data) {
        setMedicamentos(data)
      } else {
        toast.error('Error al cargar medicamentos')
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
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
  }

  const eliminarMedicamento = async (id: number) => {
    const { error } = await supabase.from('medicamentos').delete().eq('id', id)
    if (!error) {
      setMedicamentos(medicamentos.filter((m) => m.id !== id))
      toast.success('Medicamento eliminado')
    } else {
      toast.error('Error al eliminar medicamento')
    }
  }

  const abrirModalResurtir = (medicamento: Medicamento) => {
    setMedicamentoActual(medicamento)
    setNuevaFin(medicamento.fecha_fin)
    setNuevaCompra(new Date().toISOString().split('T')[0])
    setEstadoResurtido(medicamento.estado || false)
    setModalActivo(true)
  }

  const guardarResurtido = async () => {
    if (!medicamentoActual) return

    const { error } = await supabase
      .from('medicamentos')
      .update({ 
        fecha_fin: nuevaFin,
        fecha_compra: nuevaCompra,
        estado: estadoResurtido
      })
      .eq('id', medicamentoActual.id)

    if (!error) {
      const actualizados = medicamentos.map((m) =>
        m.id === medicamentoActual.id ? { 
          ...m, 
          fecha_fin: nuevaFin,
          fecha_compra: nuevaCompra,
          estado: estadoResurtido
        } : m
      )
      setMedicamentos(actualizados)
      setModalActivo(false)
      setMedicamentoActual(null)
      toast.success('Medicamento actualizado correctamente')
    } else {
      toast.error('Error al actualizar medicamento')
    }
  }

  const abrirModalEditar = (medicamento: Medicamento) => {
    setFormMedicamento(medicamento)
    setModalEditarActivo(true)
  }

  
  const guardarEdicion = async () => {
    if (!formMedicamento) return

    const { error } = await supabase
      .from('medicamentos')
      .update({
        nombre_medicamento: formMedicamento.nombre_medicamento,
        fecha_fin: formMedicamento.fecha_fin,
        fecha_compra: formMedicamento.fecha_compra,
        precio: formMedicamento.precio,
        estado: formMedicamento.estado
      })
      .eq('id', formMedicamento.id)

    if (!error) {
      const actualizados = medicamentos.map((m) =>
        m.id === formMedicamento.id ? formMedicamento : m
      )
      setMedicamentos(actualizados)
      setModalEditarActivo(false)
      toast.success('Medicamento actualizado')
    } else {
      toast.error('Error al actualizar medicamento')
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
            const puedeEliminar = medicamento.estado === true

            return (
              <div
                key={medicamento.id}
                className={`rounded-2xl shadow-md p-6 bg-white border-l-4 transition-all ${
                  terminaPronto ? 'border-red-500 bg-red-50/50' : 'border-blue-400 bg-blue-50/30'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold text-blue-900">
                    {medicamento.nombre_medicamento}
                  </h2>
                  {terminaPronto && (
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-lg">
                      Termina pronto
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Fin:</span> {formatFecha(medicamento.fecha_fin)}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Compra:</span> {formatFecha(medicamento.fecha_compra)}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Termina el medicamento en:</span>{' '}
                    <span className={terminaPronto ? 'text-red-600 font-semibold' : ''}>
                      {diasRestantes}
                      <span className="font-medium"> dias</span>{' '}
                    </span>
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Precio:</span>{' '}
                    {medicamento.precio ? `$${medicamento.precio.toFixed(2)}` : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Estado:</span>{' '}
                    <span className={medicamento.estado ? 'text-green-600' : 'text-yellow-600'}>
                      {medicamento.estado ? 'Pagado' : 'Pendiente'}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2 mt-4">
                  <button
                    onClick={() => eliminarMedicamento(medicamento.id)}
                    disabled={!puedeEliminar}
                    className={`text-sm px-4 py-2 rounded-lg transition ${
                      puedeEliminar ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => abrirModalResurtir(medicamento)}
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    Resurtir
                  </button>
                  <button
                    onClick={() => abrirModalEditar(medicamento)}
                    className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition"
                  >
                    Editar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Resurtir */}
      {modalActivo && medicamentoActual && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Resurtir {medicamentoActual.nombre_medicamento}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Fecha de compra:
                </label>
                <input
                  type="date"
                  value={nuevaCompra}
                  onChange={(e) => setNuevaCompra(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Nueva fecha de fin:
                </label>
                <input
                  type="date"
                  value={nuevaFin}
                  onChange={(e) => setNuevaFin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Estado:
                </label>
                <select
                  value={estadoResurtido ? 'true' : 'false'}
                  onChange={(e) => setEstadoResurtido(e.target.value === 'true')}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="false">Pendiente</option>
                  <option value="true">Pagado</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalActivo(false)}
                className="px-4 py-2 rounded-md text-sm bg-gray-300 hover:bg-gray-400 transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardarResurtido}
                className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditarActivo && formMedicamento && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Editar {formMedicamento.nombre_medicamento}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Nombre del medicamento:
                </label>
                <input
                  type="text"
                  value={formMedicamento.nombre_medicamento}
                  onChange={(e) =>
                    setFormMedicamento({ ...formMedicamento, nombre_medicamento: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Fecha de compra:
                </label>
                <input
                  type="date"
                  value={formMedicamento.fecha_compra}
                  onChange={(e) =>
                    setFormMedicamento({ ...formMedicamento, fecha_compra: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Fecha de fin:
                </label>
                <input
                  type="date"
                  value={formMedicamento.fecha_fin}
                  onChange={(e) =>
                    setFormMedicamento({ ...formMedicamento, fecha_fin: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Precio:
                </label>
                <input
                  type="number"
                  value={formMedicamento.precio ?? ''}
                  onChange={(e) =>
                    setFormMedicamento({ ...formMedicamento, precio: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-1">
                  Estado:
                </label>
                <select
                  value={formMedicamento.estado ? 'true' : 'false'}
                  onChange={(e) =>
                    setFormMedicamento({ ...formMedicamento, estado: e.target.value === 'true' })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="false">Pendiente</option>
                  <option value="true">Pagado</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModalEditarActivo(false)}
                className="px-4 py-2 rounded-md text-sm bg-gray-300 hover:bg-gray-400 transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withAuth(MedicamentosPage)