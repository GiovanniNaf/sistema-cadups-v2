'use client'

import { useEffect, useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { withAuth } from '@/app/components/withAuth'

interface Paciente {
  id: number
  numero_expediente: string
  nombre: string
  telefono: string
  direccion: string
}

interface Medicamento {
  id: number
  paciente_id: number
  nombre_medicamento: string
  fecha_fin: string
  fecha_compra: string
  precio: number
  estado: boolean
  paciente_nombre?: string
}

function MedicamentosPage() {
  const [pacientesConMedicamentos, setPacientesConMedicamentos] = useState<
  (Paciente & { total_medicamentos: number })[]
>([])
const [todosLosPacientes, setTodosLosPacientes] = useState<Paciente[]>([])
const [isOpen, setIsOpen] = useState(false)
const [nuevo, setNuevo] = useState({
  paciente_id: '',
  nombre_medicamento: '',
  fecha_fin: '',
  fecha_compra: '',
  precio: '',
  estado: true,
})
const [medicamentosDetallados, setMedicamentosDetallados] = useState<Medicamento[]>([])
const [searchTerm, setSearchTerm] = useState('')
const router = useRouter()

// Filtrar pacientes basados en el término de búsqueda
const filteredPacientes = pacientesConMedicamentos.filter(paciente => {
  const searchLower = searchTerm.toLowerCase()
  return (
    paciente.nombre.toLowerCase().includes(searchLower) ||
    paciente.numero_expediente.toLowerCase().includes(searchLower)
  )
})

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

    // Cargar medicamentos detallados para el reporte
    const { data: medicamentosData, error: medicamentosDetalleError } = await supabase
      .from('medicamentos')
      .select(`
        *,
        pacientes(nombre)
      `)

    if (!medicamentosDetalleError && medicamentosData) {
      const medicamentosConNombres = medicamentosData.map(m => ({
        ...m,
        paciente_nombre: (m.pacientes as { nombre: string })?.nombre || 'Sin nombre'
      }))
      setMedicamentosDetallados(medicamentosConNombres)
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
      fecha_compra: nuevo.fecha_compra,
      precio: parseFloat(nuevo.precio),
      estado: nuevo.estado,
    }

    const { error } = await supabase.from('medicamentos').insert([nuevoMedicamento])

    if (error) {
      console.error('Error al asignar medicamento:', error)
      toast.error('Hubo un error al guardar el medicamento.')
      return
    }

    toast.success('Medicamento asignado correctamente.')
    setIsOpen(false)
    setNuevo({ 
      paciente_id: '', 
      nombre_medicamento: '', 
      fecha_fin: '',
      fecha_compra: '',
      precio: '', 
      estado: true 
    })
    router.refresh()
  }

  const generarReportePDF = () => {
    if (medicamentosDetallados.length === 0) {
      toast.error('No hay medicamentos para generar el reporte')
      return
    }
  
    const doc = new jsPDF()
  
    // Título del reporte
    doc.setFontSize(18)
    doc.text('Reporte de Medicamentos por Paciente', 105, 20, { align: 'center' })
  
    // Fecha de generación
    doc.setFontSize(12)
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-MX')}`, 105, 30, { align: 'center' })
  
    // Agrupar medicamentos por paciente
    const medicamentosPorPaciente: Record<string, Medicamento[]> = {}
    medicamentosDetallados.forEach(m => {
      if (!medicamentosPorPaciente[m.paciente_nombre || '']) {
        medicamentosPorPaciente[m.paciente_nombre || ''] = []
      }
      medicamentosPorPaciente[m.paciente_nombre || ''].push(m)
    })
  
    let startY = 40
    let totalGeneral = 0
    let totalPagado = 0
    let totalPendiente = 0
  
    // Generar tabla por cada paciente
    Object.entries(medicamentosPorPaciente).forEach(([paciente, medicamentos]) => {
      // Asegurarse que el precio no sea null o undefined
      const medicamentosConPrecio = medicamentos.map(m => ({
        ...m,
        precio: m.precio || 0
      }))
  
      const totalPaciente = medicamentosConPrecio.reduce((sum, m) => sum + m.precio, 0)
      const pagadoPaciente = medicamentosConPrecio.filter(m => m.estado).reduce((sum, m) => sum + m.precio, 0)
      const pendientePaciente = totalPaciente - pagadoPaciente
      
      totalGeneral += totalPaciente
      totalPagado += pagadoPaciente
      totalPendiente += pendientePaciente
  
      // Nombre del paciente
      doc.setFontSize(14)
      doc.text(paciente, 14, startY)
      startY += 10
  
      // Tabla de medicamentos
      autoTable(doc, {
        startY,
        head: [['Medicamento', 'Precio', 'Estado', 'Fecha Compra', 'Fecha Fin']],
        body: medicamentosConPrecio.map(m => [
          m.nombre_medicamento,
          `$${(m.precio || 0).toFixed(2)}`,
          m.estado ? 'Pagado' : 'Pendiente',
          m.fecha_compra ? new Date(m.fecha_compra).toLocaleDateString('es-MX') : 'Sin fecha',
          m.fecha_fin ? new Date(m.fecha_fin).toLocaleDateString('es-MX') : 'Sin fecha'
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
  
      // Totales por paciente
      autoTable(doc, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startY: (doc as any).lastAutoTable.finalY,
        body: [
          ['Total', `$${totalPaciente.toFixed(2)}`],
          ['Pagado', `$${pagadoPaciente.toFixed(2)}`],
          ['Pendiente', `$${pendientePaciente.toFixed(2)}`]
        ],
        styles: {
          fontStyle: 'bold',
          fontSize: 11,
          cellPadding: 5
        },
        columnStyles: {
          0: { fontStyle: 'bold' }
        }
      })
  
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startY = (doc as any).lastAutoTable.finalY + 15
    })
  
    // Totales generales
    autoTable(doc, {
      startY,
      head: [['Resumen General', 'Valor']],
      body: [
        ['Total general', `$${totalGeneral.toFixed(2)}`],
        ['Total pagado', `$${totalPagado.toFixed(2)}`],
        ['Total pendiente', `$${totalPendiente.toFixed(2)}`]
      ],
      styles: {
        cellPadding: 5,
        fontSize: 12,
        fontStyle: 'bold'
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      }
    })
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-8 flex-col sm:flex-row">
        <h1 className="text-3xl font-bold text-gray-800 text-center sm:text-left">
          Pacientes con Medicamentos
        </h1>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={generarReportePDF}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Generar PDF
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium transition"
          >
            + Asignar Medicamento
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Buscar por nombre o expediente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredPacientes.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              {searchTerm ? 'No se encontraron pacientes con ese criterio' : 'No hay pacientes con medicamentos registrados'}
            </p>
          </div>
        ) : (
          filteredPacientes.map((paciente) => (
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
          ))
        )}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={nuevo.fecha_compra}
                    onChange={(e) => setNuevo({ ...nuevo, fecha_compra: e.target.value })}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={nuevo.precio}
                    onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={String(nuevo.estado)}
                    onChange={(e) =>
                      setNuevo({ ...nuevo, estado: e.target.value === 'true' })
                    }
                  >
                    <option value="true">Pagado</option>
                    <option value="false">Pendiente</option>
                  </select>
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
                      !nuevo.paciente_id ||
                      !nuevo.nombre_medicamento.trim() ||
                      !nuevo.fecha_compra ||
                      !nuevo.fecha_fin ||
                      !nuevo.precio
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

export default withAuth(MedicamentosPage)