/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil, Trash } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Paciente {
  id: number;
  nombre: string;
  numero_expediente: string;
}

interface Registro {
  id: number;
  tipo: 'deposito' | 'cobro';
  monto: number;
  concepto?: string;
  evidencia_url?: string;
  creado_en: string;
}

export default function DetallePacientePage() {
  const params = useParams();
  const router = useRouter();
  const pacienteId = Number(params.pacienteId);

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [loading, setLoading] = useState(true);

  const [deposito, setDeposito] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);

  const [cobro, setCobro] = useState('');
  const [concepto, setConcepto] = useState('');

  const [historial, setHistorial] = useState<Registro[]>([]);
  const [saldo, setSaldo] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchPaciente() {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nombre, numero_expediente')
        .eq('id', pacienteId)
        .single();
      if (error) {
        console.error('Error al obtener paciente:', error.message);
        setLoading(false);
        return;
      }
      setPaciente(data as Paciente);
      setLoading(false);
    }
    if (pacienteId) fetchPaciente();
  }, [pacienteId]);

  async function fetchSaldo() {
    const { data, error } = await supabase.rpc('obtener_saldo_personales', {
      paciente_id: pacienteId,
    });
    if (error) {
      console.error('Error al obtener saldo:', error.message);
      return;
    }
    if (data && data.length > 0) setSaldo(Number(data[0].saldo));
  }

  async function fetchHistorial() {
    const { data: depositos, error: depError } = await supabase
      .from('depositos_personales')
      .select('id, monto, evidencia_url, creado_en')
      .eq('paciente_id', pacienteId);

    const { data: cobros, error: cobError } = await supabase
      .from('cobros_personales')
      .select('id, monto, concepto, creado_en')
      .eq('paciente_id', pacienteId);

    if (depError || cobError) {
      console.error('Error al obtener historial:', depError || cobError);
      return;
    }

    const registros: Registro[] = [
      ...(depositos || []).map((d) => ({
        id: d.id,
        tipo: 'deposito' as const,
        monto: d.monto,
        evidencia_url: d.evidencia_url,
        creado_en: d.creado_en,
      })),
      ...(cobros || []).map((c) => ({
        id: c.id,
        tipo: 'cobro' as const,
        monto: c.monto,
        concepto: c.concepto,
        creado_en: c.creado_en,
      })),
    ];

    registros.sort(
      (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    );

    setHistorial(registros);
  }

  useEffect(() => {
    if (pacienteId) {
      fetchHistorial();
      fetchSaldo();
    }
  }, [pacienteId]);

  const uploadComprobante = async (file: File) => {
    const filePath = `${pacienteId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from('comprobantes')
      .upload(filePath, file);
    if (error) {
      console.error('Error al subir comprobante:', error.message);
      return null;
    }
    const { data: urlData } = supabase.storage
      .from('comprobantes')
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  };

const handleDeposito = async () => {
  if (!deposito) {
    alert('Ingresa un monto para el depósito');
    return;
  }

  if (!comprobante) {
    alert('Debes subir un comprobante del depósito');
    return;
  }

  setIsSaving(true);

  const evidenciaUrl = await uploadComprobante(comprobante);

  const { error } = await supabase.from('depositos_personales').insert([
    {
      paciente_id: pacienteId,
      monto: parseFloat(deposito),
      evidencia_url: evidenciaUrl,
    },
  ]);
  
   setIsSaving(false);

  if (error) {
    console.error('Error al insertar depósito:', error.message);
  } else {
    setDeposito('');
    setComprobante(null);
    await fetchHistorial();
    await fetchSaldo();
    alert('✅ Depósito agregado con éxito');
  }
};


  const handleCobro = async () => {
    if (!cobro || !concepto) {
      alert('Debes ingresar el monto y el concepto del cobro');
      return;
    }
    const { error } = await supabase.from('cobros_personales').insert([
      { paciente_id: pacienteId, monto: parseFloat(cobro), concepto },
    ]);
    if (error) console.error('Error al insertar cobro:', error.message);
    else {
      setCobro('');
      setConcepto('');
      await fetchHistorial();
      await fetchSaldo();
      alert('✅ Cobro registrado con éxito');
    }
  };

  const handleEliminar = async (reg: Registro) => {
    const password = prompt('⚠️ Ingrese la contraseña para eliminar:');
    if (password !== 'admin123') {
      alert('❌ Contraseña incorrecta');
      return;
    }

    if (reg.tipo === 'deposito') {
      const { error } = await supabase.from('depositos_personales').delete().eq('id', reg.id);
      if (error) console.error('Error al eliminar depósito:', error.message);
    } else {
      const { error } = await supabase.from('cobros_personales').delete().eq('id', reg.id);
      if (error) console.error('Error al eliminar cobro:', error.message);
    }

    await fetchHistorial();
    await fetchSaldo();
    alert('✅ Registro eliminado');
  };
const generarPDFHistorial = () => {
  if (!paciente) return;

  const doc = new jsPDF('p', 'pt', 'a4');
  const margin = 40;

  // Título
  doc.setFontSize(22);
  doc.text(`Historial de Personales`, margin, 40);
  doc.setFontSize(16);
  doc.text(`Paciente: ${paciente.nombre}`, margin, 65);
  doc.text(`No. Expediente: ${paciente.numero_expediente}`, margin, 85);

  // Separar depósitos y cobros
  const depositos = historial.filter((r) => r.tipo === 'deposito');
  const cobros = historial.filter((r) => r.tipo === 'cobro');

  let currentY = 110;

  // 🔹 Depósitos
  if (depositos.length > 0) {
    doc.setFontSize(16);
    doc.text('Depósitos', margin, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY + 10,
      head: [['Fecha', 'Monto']],
      body: depositos.map((d) => [
        new Date(d.creado_en).toLocaleDateString(),
        `$${d.monto.toFixed(2)}`,
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 12 },
      headStyles: { fillColor: [70, 130, 180], textColor: 255 }, // azul profesional
      theme: 'grid',
    });

    currentY = (doc as any).lastAutoTable.finalY + 30;
  }

  // 🔹 Cobros
  if (cobros.length > 0) {
    doc.setFontSize(16);
    doc.text('Cobros', margin, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY + 10,
      head: [['Fecha', 'Monto']],
      body: cobros.map((c) => [
        new Date(c.creado_en).toLocaleDateString(),
        `$${c.monto.toFixed(2)}`,
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 12 },
      headStyles: { fillColor: [220, 20, 60], textColor: 255 }, // rojo profesional
      theme: 'grid',
    });

    currentY = (doc as any).lastAutoTable.finalY + 30;
  }

  // 🔹 Saldo final
  doc.setFontSize(18);
  doc.setTextColor(0, 100, 0);
  doc.text(`Saldo Actual: $${saldo.toFixed(2)}`, margin, currentY);

  // Abrir PDF en nueva ventana
  const pdfUrl = doc.output('bloburl');
  window.open(pdfUrl);
};


  if (loading) return <p className="p-4">Cargando datos...</p>;
  if (!paciente) return <p className="p-4">Paciente no encontrado.</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => router.push('/dashboard/personales')}
        className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Regresar
      </button>

      <h1 className="text-2xl font-bold mb-2">Detalle de {paciente.nombre}</h1>
      <p className="text-sm text-gray-600 mb-4">No. Expediente: {paciente.numero_expediente}</p>
      <p className="text-lg font-semibold mb-6">
        💰 Saldo actual: <span className="text-green-600">${saldo.toFixed(2)}</span>
      </p>

      <button
        onClick={generarPDFHistorial}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
      >
        📄 Generar Reporte
      </button>

      <Tabs defaultValue="deposito" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="deposito">Depósitos</TabsTrigger>
          <TabsTrigger value="cobro">Cobros</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>


       {/* Depósitos */}
<TabsContent value="deposito">
  <div className="border p-4 rounded space-y-3">
    <h2 className="text-lg font-semibold">Agregar Depósito</h2>
    <input
      type="number"
      placeholder="Monto"
      value={deposito}
      onChange={(e) => setDeposito(e.target.value)}
      className="border px-3 py-2 rounded w-full"
      required
    />

    <label className="block">
      <span className="text-sm text-gray-600">Comprobante</span>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          setComprobante(file);

          // Preview solo para imágenes
          if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
              const imgPreview = document.getElementById('preview') as HTMLImageElement;
              if (imgPreview) imgPreview.src = reader.result as string;
            };
            reader.readAsDataURL(file);
          }
        }}
        className="mt-1 block w-full text-sm text-gray-500
        file:mr-4 file:py-2 file:px-4
        file:rounded file:border-0
        file:text-sm file:font-semibold
        file:bg-blue-50 file:text-blue-700
        hover:file:bg-blue-100"
        required
      />
    </label>

    {/* Preview de imagen */}
    {comprobante && comprobante.type.startsWith('image/') && (
 
      <img
        id="preview"
        src={URL.createObjectURL(comprobante)}
        alt="Vista previa del comprobante"
        className="mt-2 max-h-40 border rounded"
      />
    )}

   <button
  onClick={handleDeposito}
  disabled={isSaving} // evita doble clic
  className={`w-full px-4 py-2 rounded transition ${
    isSaving
      ? 'bg-yellow-500 cursor-not-allowed' // mientras guarda
      : 'bg-green-500 hover:bg-green-600'
  } text-white`}
>
  {isSaving ? 'Procesando...' : 'Guardar Depósito'}
</button>

  </div>
</TabsContent>

        {/* Cobros */}
        <TabsContent value="cobro">
          <div className="border p-4 rounded space-y-3">
            <h2 className="text-lg font-semibold">Registrar Cobro</h2>
            <input
              type="text"
              placeholder="Concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="border px-3 py-2 rounded w-full"
            />
            <input
              type="number"
              placeholder="Monto"
              value={cobro}
              onChange={(e) => setCobro(e.target.value)}
              className="border px-3 py-2 rounded w-full"
            />
            <button
              onClick={handleCobro}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition w-full"
            >
              Guardar Cobro
            </button>
          </div>
        </TabsContent>

        {/* Historial */}
        <TabsContent value="historial">
          <div className="border p-4 rounded">
            <h2 className="text-lg font-semibold mb-4">Historial</h2>
            {historial.length === 0 ? (
              <p className="text-gray-500">No hay registros aún.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Monto</th>
                    <th className="p-2">Concepto / Comprobante</th>
                    <th className="p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((reg) => (
                    <tr key={`${reg.tipo}-${reg.id}`} className="border-t">
                      <td className="p-2">{new Date(reg.creado_en).toLocaleDateString()}</td>
                      <td className="p-2 capitalize">{reg.tipo}</td>
                      <td className="p-2 font-semibold">${reg.monto.toFixed(2)}</td>
                      <td className="p-2">
                        {reg.tipo === 'cobro' && reg.concepto}
                        {reg.tipo === 'deposito' && reg.evidencia_url && (
                          <a href={reg.evidencia_url} target="_blank" className="text-blue-600 underline">
                            Ver comprobante
                          </a>
                        )}
                      </td>
                      <td className="p-2 flex space-x-2">
                        <button onClick={() => handleEliminar(reg)} title="Eliminar">
                          <Trash className="w-5 h-5 text-red-600 hover:text-red-800" />
                        </button>
                        <button onClick={() => alert('Función editar aún no implementada')} title="Editar">
                          <Pencil className="w-5 h-5 text-blue-600 hover:text-blue-800" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
