// src/components/VisitasCalendar.tsx
'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '@/lib/supabase';
import { Toaster, toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Visita {
  id: number;
  paciente_id: number;
  fecha: string;
  numero_personas: number;
  horario: string;
  paciente_nombre?: string;
}

interface Paciente {
  id: number;
  nombre: string;
}

export default function VisitasCalendar() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [modalActivo, setModalActivo] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<number | null>(null);
  const [nuevoNumeroPersonas, setNuevoNumeroPersonas] = useState(1);
  const [rangoFechas, setRangoFechas] = useState({ inicio: '', fin: '' });
  const [reporte, setReporte] = useState<Visita[]>([]);
  const [visitasDelDia, setVisitasDelDia] = useState<Visita[]>([]);
  const [nuevoHorario, setNuevoHorario] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Obtener TODOS los pacientes primero
        const { data: pacientesData } = await supabase
          .from('pacientes')
          .select('id, nombre, fecha_ingreso')
          .order('nombre', { ascending: true });

        // Filtrar pacientes con más de 2 meses de antigüedad
        if (pacientesData) {
          const hoy = new Date();
          const dosMesesAtras = new Date(hoy.setMonth(hoy.getMonth() - 2));

          const pacientesFiltrados = pacientesData.filter(paciente => {
            // Asegurar que la fecha se interpreta correctamente
            const fechaIngreso = new Date(paciente.fecha_ingreso + 'T00:00:00');
            return fechaIngreso < dosMesesAtras;
          });

          setPacientes(pacientesFiltrados);
          console.log('Pacientes filtrados:', pacientesFiltrados); // Para depuración
        }

        // Resto de tu código para cargar visitas...
        const { data: visitasData } = await supabase
          .from('visitas')
          .select(`*, pacientes(nombre)`)
          .order('fecha', { ascending: false });

        if (visitasData) {
          const visitasConNombres = visitasData.map(v => ({
            ...v,
            paciente_nombre: (v.pacientes as { nombre: string })?.nombre || `Paciente ${v.paciente_id}`
          }));
          setVisitas(visitasConNombres);
        }
      } catch (error) {
        toast.error('Error al cargar datos');
        console.error('Error al cargar datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);


  // Agrega esta función al componente
  const handleCancelarVisita = async (visitaId: number) => {
    try {
      const { error } = await supabase
        .from('visitas')
        .delete()
        .eq('id', visitaId);

      if (!error) {
        // Actualizar el estado local
        setVisitas(visitas.filter(v => v.id !== visitaId));
        setVisitasDelDia(visitasDelDia.filter(v => v.id !== visitaId));
        toast.success('Visita cancelada correctamente');
      } else {
        throw error;
      }
    } catch (error) {
      toast.error('Error al cancelar la visita');
      console.error('Error al cancelar visita:', error);
    }
  };


  const formatMexicoDate = (dateStr: string) => {
    // Crear fecha en UTC (asume que dateStr es YYYY-MM-DD)
    const date = new Date(dateStr + 'T12:00:00Z'); // Mediodía UTC

    // Ajustar a hora de México (UTC-6 o UTC-5)
    const offsetMexico = date.getTimezoneOffset() + (date.getTimezoneOffset() > 0 ? 360 : 300);
    date.setMinutes(date.getMinutes() + offsetMexico);

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleDateClick = (arg: any) => {
    setNuevaFecha(arg.dateStr);
    setModalActivo(true);
    const visitasEnFecha = visitas.filter((v) => v.fecha === arg.dateStr);
    setVisitasDelDia(visitasEnFecha);
    setPacienteSeleccionado(null);
  };

  // Modifica la función handleAddVisita:
  const handleAddVisita = async () => {
    if (!pacienteSeleccionado) {
      toast.error('Seleccione un paciente');
      return;
    }

    if (!nuevoNumeroPersonas || nuevoNumeroPersonas < 1) {
      toast.error('Número de personas inválido');
      return;
    }

    if (!nuevoHorario) {
      toast.error('Seleccione un horario');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('visitas')
        .insert([{
          paciente_id: pacienteSeleccionado,
          fecha: nuevaFecha,
          numero_personas: nuevoNumeroPersonas,
          horario: nuevoHorario // Añadir el horario
        }])
        .select(`*, pacientes(nombre)`);

      if (data) {
        const nuevaVisita = {
          ...data[0],
          paciente_nombre: (data[0].pacientes as { nombre: string })?.nombre || `Paciente ${data[0].paciente_id}`
        };
        setVisitas([nuevaVisita, ...visitas]);
        toast.success('Visita agendada con éxito');
        setModalActivo(false);
        setNuevoHorario(''); // Resetear el campo
      }
    } catch (error) {
      toast.error('Error al agendar visita');
    }
  };

  const handleGenerateReport = async () => {
    if (!rangoFechas.inicio || !rangoFechas.fin) {
      toast.error('Seleccione un rango de fechas válido');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('visitas')
        .select(`*, pacientes(nombre)`)
        .gte('fecha', rangoFechas.inicio)
        .lte('fecha', rangoFechas.fin)
        .order('fecha', { ascending: false });

      if (data) {
        const reporteConNombres = data.map(v => ({
          ...v,
          paciente_nombre: (v.pacientes as { nombre: string })?.nombre || `Paciente ${v.paciente_id}`
        }));
        setReporte(reporteConNombres);
        toast.success(`Reporte generado con ${data.length} visitas`);
      }
    } catch (error) {
      toast.error('Error al generar reporte');
    }
  };

  const generarPDF = () => {
    if (reporte.length === 0) {
      toast.error('No hay datos para generar el reporte');
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Reporte de Visitas UPS', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Del ${rangoFechas.inicio} al ${rangoFechas.fin}`, 105, 28, { align: 'center' });
    doc.text(`Total de visitas: ${reporte.length}`, 105, 35, { align: 'center' });

    autoTable(doc, {
      startY: 45,
      head: [['Paciente', 'Fecha', 'Horario', 'Personas']], // Añadir columna Horario
      body: reporte.map((v) => [
        v.paciente_nombre,
        v.fecha,
        v.horario, // Mostrar el horario
        v.numero_personas.toString()
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
    });

    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Toaster position="top-right" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Calendario de Visitas
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-8">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={visitas.map((visita) => ({
            title: `${visita.paciente_nombre} (${visita.numero_personas})`,
            date: visita.fecha,
            backgroundColor: '#3B82F6',
            borderColor: '#3B82F6'
          }))}
          dateClick={handleDateClick}
          locale="es"
          height="auto"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek'
          }}
        />
      </div>

      {modalActivo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">

            <div className="flex justify-between items-center border-b p-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Agendar Visita - {formatMexicoDate(nuevaFecha)}
              </h3>
              <button
                onClick={() => setModalActivo(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>


            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paciente
                </label>
                <select
                  value={pacienteSeleccionado || ''}
                  onChange={(e) => setPacienteSeleccionado(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccione un paciente</option>
                  {pacientes.map((paciente) => (
                    <option key={paciente.id} value={paciente.id}>
                      {paciente.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horario
                </label>
                <select
                  value={nuevoHorario}
                  onChange={(e) => setNuevoHorario(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccione un horario</option>
                  <option value="11 AM a 2 PM">11 AM a 2 PM</option>
                  <option value="2 PM a 5 PM">2 PM a 5 PM</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de personas
                </label>
                <input
                  type="number"
                  value={nuevoNumeroPersonas}
                  onChange={(e) => setNuevoNumeroPersonas(Number(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Visitas existentes este día: {visitasDelDia.length}
                </h4>
                {visitasDelDia.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    <ul className="divide-y divide-gray-200">
                      {visitasDelDia.map((v) => (
                        <li key={v.id} className="py-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">{v.paciente_nombre}</p>
                              <p className="text-xs text-gray-500">{v.horario} • {v.numero_personas} personas</p>
                            </div>
                            <button
                              onClick={() => handleCancelarVisita(v.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No hay visitas programadas para esta fecha</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-3">
              <button
                onClick={() => setModalActivo(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddVisita}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Agregar Visita
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Generar Reporte</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={rangoFechas.inicio}
              onChange={(e) => setRangoFechas({ ...rangoFechas, inicio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={rangoFechas.fin}
              onChange={(e) => setRangoFechas({ ...rangoFechas, fin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Generar Reporte
            </button>
          </div>
        </div>

        {reporte.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">
                Resultados: {reporte.length} visitas encontradas
              </h3>
              <button
                onClick={generarPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Exportar PDF
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personas</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reporte.map((v) => (
                    <tr key={v.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.paciente_nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.fecha}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.horario}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.numero_personas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}