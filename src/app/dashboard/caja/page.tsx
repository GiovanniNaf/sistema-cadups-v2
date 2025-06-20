'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable, { Styles } from 'jspdf-autotable';

interface Paciente {
  id: number;
  nombre: string;
  numero_expediente: string;
  monto_corte: number | null;
  estado_corte: boolean | null;
  limite_credito: number | null;
  observaciones: string | null;
}

export default function CajaPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [pacientesOriginales, setPacientesOriginales] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    async function fetchPacientesConSaldos() {
      const { data, error } = await supabase.rpc('obtener_datos_pacientes').select("*");

      if (error) {
        console.error('Error al obtener datos:', error.message);
        return;
      }

      setPacientes(data as Paciente[]);
      setPacientesOriginales(data as Paciente[]);
      setLoading(false);
    }

    fetchPacientesConSaldos();
  }, []);

  const handleBusqueda = (texto: string) => {
    setBusqueda(texto);
    const textoLower = texto.toLowerCase();
    const filtrados = pacientesOriginales.filter((p) =>
      p.nombre.toLowerCase().includes(textoLower) ||
      p.numero_expediente.toLowerCase().includes(textoLower)
    );
    setPacientes(filtrados);
  };

  const generarReportePDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm'
    });

    const margin = 5;
    const fontSizeSmall = 7;
    const fontSizeHeader = 8;

    const hoy = new Date();
    const formatoFecha: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "long",
      year: "numeric"
    };

    const hoyFormateado = hoy.toLocaleDateString('es-MX', formatoFecha);

    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE TIENDA', margin, margin);
    doc.text(`Fecha: ${hoyFormateado}`, doc.internal.pageSize.getWidth() - margin - 50, margin);

    const startY = margin + 12;

    const columnStyles: { [key: string]: Partial<Styles> } = {
      "0": { cellWidth: 45, halign: 'center' },
      "1": { cellWidth: 20, halign: 'left' },
      "2": { cellWidth: 20, halign: 'center' },
      "3": { cellWidth: 20, halign: 'center' },
      "4": { cellWidth: 20, halign: 'center' },
      "5": { cellWidth: 25, halign: 'center' },
      "6": { cellWidth: 25, halign: 'center' },
      "7": { cellWidth: 25, halign: 'center' },
      "8": { cellWidth: 20, halign: 'center' },
      "9": { cellWidth: 25, halign: 'center' },
      "10": { cellWidth: 25, halign: 'center' },
      "11": { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
    };
    autoTable(doc, {
      head: [['NOMBRE', 'ESTADO', 'OBSERVACIONES', 'CIGARRO', 'CAFE', 'GALLETAS', 'SABRITAS', 'REFRESCOS', 'VARIOS', 'TOTAL', 'FIRMA']],
      body: pacientes.map(p => [
        p.nombre + ` ($${p.limite_credito?.toFixed(2) || '0.00'})`,
        p.estado_corte === null || p.estado_corte ? 'CON CRÉDITO' : 'SIN CRÉDITO',
        p.observaciones || '',
        ''
      ]),

      startY: startY,
      margin: { left: margin, right: margin },
      tableWidth: 'wrap',
      styles: {
        fontSize: fontSizeSmall,
        cellPadding: 2,
        valign: 'middle',
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.3
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: fontSizeHeader,
        cellPadding: 3
      },
      bodyStyles: {
        cellPadding: 2
      },
      didParseCell: function (data) {
        if (data.section === 'body') {
          if (data.cell.raw === 'SIN CRÉDITO') {
            data.cell.styles = {
              ...(data.cell.styles || {}),
              fillColor: [255, 200, 200],
              textColor: [200, 0, 0]
            };
          } else if (data.cell.raw === 'CRÉDITO DISPONIBLE') {
            data.cell.styles = {
              ...(data.cell.styles || {}),
              fillColor: [200, 255, 200],
              textColor: [0, 100, 0]
            };
          }
        }
      },
      columnStyles: columnStyles,
      didDrawPage: function (data) {
        doc.setFontSize(6);
        doc.text(
          `Pág. ${data.pageNumber}`,
          doc.internal.pageSize.getWidth() - margin - 5,
          doc.internal.pageSize.getHeight() - 3
        );
      }
    });

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  if (loading) return <p className="p-4">Cargando pacientes...</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Caja de Pacientes</h1>
        <button
          onClick={generarReportePDF}
          className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Generar Reporte
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre o expediente..."
        value={busqueda}
        onChange={(e) => handleBusqueda(e.target.value)}
        className="w-full mb-6 px-4 py-2 border border-gray-300 rounded-md shadow-sm"
      />

      {pacientes.length === 0 ? (
        <p>No se encontraron pacientes.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pacientes.map((p) => (
            <div key={p.id} className="border rounded-lg p-4 shadow-sm bg-white">
              <h3 className="text-lg font-semibold">{p.nombre}</h3>
              <p className="text-sm text-gray-600">Expediente: {p.numero_expediente}</p>

              {/* Solo cambiamos el texto visualmente */}
              <p className="mt-2 font-medium">
                {p.estado_corte === false ? (
                  <span className="text-red-600">
                    SIN CRÉDITO - Deuda: ${p.monto_corte?.toFixed(2) || '0.00'}
                  </span>
                ) : (
                  <span className="text-green-600">Sin adeudo</span>
                )}
              </p>

              <Link
                href={`/dashboard/caja/${p.id}`}
                className="mt-3 inline-block bg-blue-500 text-white py-1 px-3 rounded text-sm hover:bg-blue-600"
              >
                Ver detalles
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}