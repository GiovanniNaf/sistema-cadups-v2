'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import { TrashIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'

interface Interconsulta {
  id: number
  paciente_id: number
  fecha: string
  observacion: string
  completada: boolean
  especialista: string
}

interface PacienteInfo {
  nombre: string
  edad: number
  numero_expediente: string
}

export default function InterconsultasPage() {
  const { pacienteId } = useParams()
 
  const [pacienteInfo, setPacienteInfo] = useState<PacienteInfo>({ nombre: '', edad: 0, numero_expediente: '' })
  const [interconsultas, setInterconsultas] = useState<Interconsulta[]>([])
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!pacienteId) return
  
      const { data: interconsultasData, error: interconsultasError } = await supabase
        .from('interconsultas')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha', { ascending: false })
  
      if (interconsultasError) {
        console.error('Error al cargar las interconsultas:', interconsultasError)
        toast.error('Error al cargar interconsultas')
      } else {
        setInterconsultas(interconsultasData || [])
      }
  
      const { data: pacienteData, error: pacienteError } = await supabase
        .from('pacientes')
        .select('nombre, edad, numero_expediente')
        .eq('id', pacienteId)
        .single()
  
      if (pacienteError) {
        console.error('Error al cargar datos del paciente:', pacienteError)
        toast.error('Error al cargar datos del paciente')
      } else if (pacienteData) {
        setPacienteInfo({
          nombre: pacienteData.nombre,
          edad: pacienteData.edad,
          numero_expediente: pacienteData.numero_expediente
        })
      }
    }
  
    fetchData()
  }, [pacienteId])

  const eliminarInterconsulta = async (id: number) => {
    setIsDeleting(id)
    try {
      const { error } = await supabase
        .from('interconsultas')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setInterconsultas(prev => prev.filter(i => i.id !== id))
      toast.success('Interconsulta eliminada correctamente')
    } catch (error) {
      console.error('Error al eliminar interconsulta:', error)
      toast.error('Error al eliminar interconsulta')
    } finally {
      setIsDeleting(null)
    }
  }

  const generarPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Configuración de estilos
    const primaryColor = '#4f46e5'
    const secondaryColor = '#6b7280'
    const fontSizeSmall = 10
    const fontSizeNormal = 12
    const fontSizeLarge = 16
    const margin = 15
    let currentY = margin

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const checkForNewPage = (spaceNeeded: number) => {
      if (currentY + spaceNeeded > doc.internal.pageSize.height - margin) {
        doc.addPage()
        currentY = margin
        return true
      }
      return false
    }

    const sortedInterconsultas = [...interconsultas].sort((a, b) => 
      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )

    for (let i = 0; i < sortedInterconsultas.length; i += 2) {
      if (i > 0) {
        doc.addPage()
        currentY = margin
      }

      doc.setFontSize(fontSizeLarge)
      doc.setTextColor(primaryColor)
      doc.setFont('helvetica', 'bold')
      doc.text('NOTA MÉDICA - INTERCONSULTAS', 105, currentY, { align: 'center' })
      currentY += 10

      doc.setFontSize(fontSizeNormal)
      doc.setTextColor(secondaryColor)
      doc.setFont('helvetica', 'normal')
      doc.text(`Paciente: ${pacienteInfo.nombre}`, margin, currentY)
      doc.text(`Edad: ${pacienteInfo.edad} años`, 105, currentY)
      doc.text(`Expediente: ${pacienteInfo.numero_expediente}`, margin, currentY + 7)
      currentY += 20

      for (let j = i; j < Math.min(i + 2, sortedInterconsultas.length); j++) {
        const interconsulta = sortedInterconsultas[j]
        
        doc.setFillColor(245, 245, 255)
        doc.roundedRect(
          margin, 
          currentY, 
          doc.internal.pageSize.width - 2 * margin, 
          60, 
          3, 3, 'F'
        )

        doc.setFontSize(fontSizeNormal)
        doc.setTextColor(primaryColor)
        doc.setFont('helvetica', 'bold')
        doc.text(`Interconsulta #${j + 1}`, margin + 5, currentY + 7)

        doc.setFontSize(fontSizeSmall)
        doc.setTextColor(secondaryColor)
        doc.setFont('helvetica', 'normal')
        doc.text(`Fecha: ${formatFecha(interconsulta.fecha)}`, margin + 5, currentY + 15)
        doc.text(`Especialista: ${interconsulta.especialista}`, 105, currentY + 15)
        
        doc.setTextColor(interconsulta.completada ? '#10b981' : '#ef4444')
        doc.text(
          `Estado: ${interconsulta.completada ? 'COMPLETADA' : 'PENDIENTE'}`,
          doc.internal.pageSize.width - margin - 40,
          currentY + 15
        )

        doc.setDrawColor(200, 200, 200)
        doc.line(margin + 5, currentY + 20, doc.internal.pageSize.width - margin - 5, currentY + 20)

        doc.setFontSize(fontSizeNormal)
        doc.setTextColor('#111827')
        const splitText = doc.splitTextToSize(
          interconsulta.observacion, 
          doc.internal.pageSize.width - 2 * margin - 10
        )
        doc.text(splitText, margin + 5, currentY + 30)

        doc.setFontSize(fontSizeSmall)
        doc.setTextColor(secondaryColor)
        doc.text('_________________________________', margin + 5, currentY + 50)
        doc.text('Firma del especialista', margin + 5, currentY + 55)

        currentY += 70
      }
    }

    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha)
      .toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      })
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Interconsultas de <span className="text-indigo-600">{pacienteInfo.nombre}</span>
        </h1>
        <div className="flex gap-2">
         
          <button
            onClick={generarPDF}
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            Generar PDF
          </button>
        </div>
      </div>

      {interconsultas.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 text-center border border-gray-200">
          <p className="text-gray-500">No hay interconsultas registradas para este paciente.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {interconsultas.map((interconsulta) => (
            <div
              key={interconsulta.id}
              className={`relative rounded-xl p-6 shadow-sm transition-all hover:shadow-md overflow-hidden
                ${interconsulta.completada ? 'bg-gradient-to-br from-green-50 to-white border-l-4 border-green-500' 
                  : 'bg-gradient-to-br from-blue-50 to-white border-l-4 border-blue-500'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 bg-white/50 px-2 py-1 rounded">
                    {formatFecha(interconsulta.fecha)}
                  </span>
                  <span className="ml-2 text-sm font-medium text-indigo-600">
                    {interconsulta.especialista}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    interconsulta.completada 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {interconsulta.completada ? 'Completada' : 'Pendiente'}
                  </span>
                  <button
                    onClick={() => eliminarInterconsulta(interconsulta.id)}
                    disabled={isDeleting === interconsulta.id}
                    className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Eliminar interconsulta"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <p className="text-gray-800 whitespace-pre-line">
                {interconsulta.observacion}
              </p>
              <div className={`absolute top-0 left-0 w-1 h-full ${
                interconsulta.completada ? 'bg-green-500' : 'bg-blue-500'
              }`}></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}