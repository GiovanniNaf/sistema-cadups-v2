'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Interconsulta {
  id: number
  paciente_id: number
  fecha: string
  observacion: string
  completada: boolean
}

export default function InterconsultasPage() {
  const { pacienteId } = useParams()
  const [nombrePaciente, setNombrePaciente] = useState('')
  const [interconsultas, setInterconsultas] = useState<Interconsulta[]>([])

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
      } else {
        setInterconsultas(interconsultasData || [])
      }
  
      const { data: pacienteData, error: pacienteError } = await supabase
        .from('pacientes')
        .select('nombre')
        .eq('id', pacienteId)
        .single()
  
      if (pacienteError) {
        console.error('Error al cargar el nombre del paciente:', pacienteError)
      } else if (pacienteData) {
        setNombrePaciente(pacienteData.nombre)
      }
    }
  
    fetchData()
  }, [pacienteId])

  const generarPDF = () => {
    const doc = new jsPDF()
    
    doc.text(`Reporte de Interconsultas de ${nombrePaciente}`, 14, 20)
  
    autoTable(doc, {
      head: [['Fecha', 'Observación', 'Estado']],
      body: interconsultas.map((i) => [
        i.fecha,
        i.observacion,
        i.completada ? 'Completado' : 'Pendiente',
      ]),
      startY: 30,
    })
  
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Interconsultas de <span className="text-indigo-600">{nombrePaciente}</span>
        </h1>
        <button
          onClick={generarPDF}
          className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
        >
          Generar PDF
        </button>
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
                <span className="text-sm font-medium text-gray-500 bg-white/50 px-2 py-1 rounded">
                  {formatFecha(interconsulta.fecha)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  interconsulta.completada 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {interconsulta.completada ? 'Completada' : 'Pendiente'}
                </span>
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