'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Paciente {
  id: number;
  nombre: string;
  numero_expediente: string;
  saldo: number;
  personales: boolean; // 👈 campo boolean
}

export default function CajaPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [pacientesOriginales, setPacientesOriginales] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    async function fetchPacientesConSaldos() {
      const { data, error } = await supabase
        .rpc('obtener_saldo_personales2')
        .select('*');

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
    const filtrados = pacientesOriginales.filter(
      (p) =>
        p.nombre.toLowerCase().includes(textoLower) ||
        p.numero_expediente.toLowerCase().includes(textoLower)
    );
    setPacientes(filtrados);
  };

  const generarPDF = () => {
    // 👇 Filtramos SOLO los personales con saldo a favor
    const pacientesSaldoAFavor = pacientes.filter(
      (p) => p.personales === true && p.saldo > 0
    );

    if (pacientesSaldoAFavor.length === 0) {
      alert('No hay pacientes personales con saldo a favor');
      return;
    }

    const doc = new jsPDF('landscape', 'pt', 'a4');
    const margin = 40;

    doc.setFontSize(16);
    doc.text('Lista de Personales Domingo', margin, 50);
    doc.setFontSize(16);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, margin, 75);

    const body = pacientesSaldoAFavor.map((p) => [
      p.nombre,
      `$${p.saldo.toFixed(2)}`,
      '',
      '',
      '',
      '',
    ]);

    autoTable(doc, {
      startY: 100,
      head: [
        [
          'Nombre',
          'Saldo a favor',
          'Producto solicitado',
          'Costo',
          'Firma Enterado',
          'Firma Recibido',
        ],
      ],
      body,
      margin: { left: 40, right: 40 },
      styles: {
        fontSize: 13,
        cellPadding: 10,
        textColor: 0,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: { fillColor: 220, textColor: 0, fontStyle: 'bold' },
      theme: 'grid',
      didDrawCell: (data) => {
        doc.setLineWidth(1.2);
        doc.setDrawColor(0);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
      },
    });

    const pdfUrl = doc.output('bloburl');
    window.open(pdfUrl);
  };

  if (loading) return <p className="p-4">Cargando pacientes...</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Caja de Personales</h1>

      <div className="flex justify-between items-center mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o expediente..."
          value={busqueda}
          onChange={(e) => handleBusqueda(e.target.value)}
          className="w-full md:w-2/3 px-4 py-2 border border-gray-300 rounded-md shadow-sm"
        />
        <button
          onClick={generarPDF}
          className="ml-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Generar PDF
        </button>
      </div>

      {pacientes.length === 0 ? (
        <p>No se encontraron pacientes.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pacientes.map((p) => (
            <div
              key={p.id}
              className={`border rounded-lg p-4 shadow-sm flex flex-col justify-between
                ${p.personales ? 'bg-green-100 border-green-400' : 'bg-blue-100 border-blue-600'}`}
            >
              <div>
                <p className="text-lg font-semibold">{p.nombre}</p>
                <p className="text-sm text-gray-600">
                  No. Expediente: {p.numero_expediente}
                </p>
                <p className="mt-2 font-medium">
                  {p.saldo > 0 ? (
                    <span className="text-green-600">
                      Saldo a favor: ${p.saldo.toFixed(2)}
                    </span>
                  ) : p.saldo < 0 ? (
                    <span className="text-red-600">
                      Deuda pendiente: ${Math.abs(p.saldo).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-gray-600">Saldo: $0.00</span>
                  )}
                </p>
              </div>
              <Link
                href={`/dashboard/personales/${p.id}`}
                className="mt-4 text-center bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
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
