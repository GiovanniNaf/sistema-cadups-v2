'use client'

import { useEffect, useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Paciente {
  id: number
  numero_expediente: string
  nombre: string
  edad: number
  fecha_ingreso: string
  numero_contacto: string
}

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [nuevoPaciente, setNuevoPaciente] = useState({
    numero_expediente: '',
    nombre: '',
    edad: '',
    fecha_ingreso: '',
    numero_contacto: ''
  })
  const [loading, setLoading] = useState(false)
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<number | null>(null)

  useEffect(() => {
    const fetchPacientes = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('pacientes')
          .select('*')
          .order('nombre', { ascending: true })

        if (error) throw error
        setPacientes(data || [])
      } catch (error) {
        toast.error('Error al cargar pacientes')
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPacientes()
  }, [])

  const crearPaciente = async () => {
    if (!nuevoPaciente.nombre || !nuevoPaciente.numero_expediente) {
      toast.error('Nombre y número de expediente son requeridos')
      return
    }

    try {
      const { data, error } = await supabase
        .from('pacientes')
        .insert([{
          ...nuevoPaciente,
          edad: Number(nuevoPaciente.edad) || null
        }])
        .select()

      if (error) throw error

      setPacientes([...(data as Paciente[]), ...pacientes])
      toast.success('Paciente creado exitosamente')
      setIsOpen(false)
      setNuevoPaciente({
        numero_expediente: '',
        nombre: '',
        edad: '',
        fecha_ingreso: '',
        numero_contacto: ''
      })
    } catch (error) {
      toast.error('Error al crear paciente')
      console.error('Error:', error)
    }
  }

  const eliminarPaciente = async (id: number) => {
    try {
      const { error } = await supabase
        .from('pacientes')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPacientes(pacientes.filter(p => p.id !== id))
      toast.success('Paciente eliminado correctamente')
      setConfirmacionEliminar(null)
    } catch (error) {
      toast.error('Error al eliminar paciente')
      console.error('Error:', error)
    }
  }

  const generarReporteLlamadas = () => {
    const pacientesLlamada = pacientes.filter(paciente => {
      const fechaIngreso = new Date(paciente.fecha_ingreso)
      const dosMesesAtras = new Date()
      dosMesesAtras.setMonth(dosMesesAtras.getMonth() - 2)
      return fechaIngreso < dosMesesAtras
    })

    if (pacientesLlamada.length === 0) {
      toast.error('No hay pacientes disponibles para llamada')
      return
    }

    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.setTextColor(40, 40, 40)
    doc.text('Reporte de Pacientes para Llamada', 105, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.text(`Total de pacientes: ${pacientesLlamada.length}`, 105, 30, { align: 'center' })
    
    autoTable(doc, {
      startY: 40,
      head: [['Expediente', 'Nombre', 'Edad', 'Teléfono', 'Fecha Ingreso']],
      body: pacientesLlamada.map(p => [
        p.numero_expediente,
        p.nombre,
        p.edad.toString(),
        p.numero_contacto,
        new Date(p.fecha_ingreso).toLocaleDateString('es-MX')
      ]),
      styles: {
        cellPadding: 5,
        fontSize: 10,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    })

    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  }

  const esPacienteLlamada = (fechaIngreso: string) => {
    if (!fechaIngreso) return false
    const fecha = new Date(fechaIngreso)
    const dosMesesAtras = new Date()
    dosMesesAtras.setMonth(dosMesesAtras.getMonth() - 2)
    return fecha < dosMesesAtras
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Toaster position="top-right" />
      
      <div className="flex justify-between items-center mb-8 flex-col sm:flex-row gap-4">
        <h1 className="text-3xl font-bold text-gray-800 text-center sm:text-left">
          Lista de Pacientes
        </h1>
        <div className="flex gap-3">
          <button
            onClick={generarReporteLlamadas}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Reporte Llamadas
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            + Nuevo Paciente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Cargando pacientes...</div>
      ) : (
        <div className="space-y-4">
          {pacientes.map((paciente) => (
            <div
              key={paciente.id}
              className="bg-white p-4 md:p-6 rounded-xl shadow-md hover:shadow-lg transition-all relative"
            >
              {esPacienteLlamada(paciente.fecha_ingreso) && (
                <span className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Llamada Disponible
                </span>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-lg md:text-xl font-semibold text-gray-900">{paciente.nombre}</p>
                  <p className="text-sm text-gray-600">
                    Expediente: <span className="font-medium">{paciente.numero_expediente}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Edad: <span className="font-medium">{paciente.edad}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Teléfono: <span className="font-medium">{paciente.numero_contacto}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Fecha ingreso: <span className="font-medium">
                      {new Date(paciente.fecha_ingreso).toLocaleDateString('es-MX')}
                    </span>
                  </p>
                  {esPacienteLlamada(paciente.fecha_ingreso) && (
                    <p className="text-sm text-green-600 font-medium">
                      Disponible para recibir llamadas
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-4 space-x-2">
                <button
                  onClick={() => setConfirmacionEliminar(paciente.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 border border-red-200 rounded hover:bg-red-50 transition-colors"
                >
                  Eliminar
                </button>
              </div>

              {/* Modal de confirmación para eliminar */}
              {confirmacionEliminar === paciente.id && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar eliminación</h3>
                    <p className="text-sm text-gray-500 mb-6">¿Estás seguro que deseas eliminar a {paciente.nombre}? Esta acción no se puede deshacer.</p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setConfirmacionEliminar(null)}
                        className="px-4 py-2 text-gray-600 hover:underline"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => eliminarPaciente(paciente.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVO PACIENTE */}
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
              <Dialog.Title className="text-xl font-semibold mb-4">Nuevo Paciente</Dialog.Title>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Expediente*</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevoPaciente.numero_expediente}
                    onChange={(e) => setNuevoPaciente({...nuevoPaciente, numero_expediente: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo*</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevoPaciente.nombre}
                    onChange={(e) => setNuevoPaciente({...nuevoPaciente, nombre: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevoPaciente.edad}
                    onChange={(e) => setNuevoPaciente({...nuevoPaciente, edad: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevoPaciente.fecha_ingreso}
                    onChange={(e) => setNuevoPaciente({...nuevoPaciente, fecha_ingreso: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Contacto</label>
                  <input
                    type="tel"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={nuevoPaciente.numero_contacto}
                    onChange={(e) => setNuevoPaciente({...nuevoPaciente, numero_contacto: e.target.value})}
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
                    onClick={crearPaciente}
                    disabled={!nuevoPaciente.nombre || !nuevoPaciente.numero_expediente}
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