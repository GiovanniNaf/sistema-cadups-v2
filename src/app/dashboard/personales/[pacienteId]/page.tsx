/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil, Trash, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Paciente {
  id: number;
  nombre: string;
  numero_expediente: string;
  personales: boolean;
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
  const [toggleLoading, setToggleLoading] = useState(false);

  // Estados para edición en modal
  const [editRegistro, setEditRegistro] = useState<Registro | null>(null);
  const [editMonto, setEditMonto] = useState<number | ''>('');
  const [editConcepto, setEditConcepto] = useState<string>('');

  useEffect(() => {
    async function fetchPaciente() {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nombre, numero_expediente, personales')
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

  // 🔹 Alternar personales
  const togglePersonales = async () => {
    if (!paciente) return;
    setToggleLoading(true);

    const nuevoValor = !paciente.personales;
    const { error } = await supabase
      .from('pacientes')
      .update({ personales: nuevoValor })
      .eq('id', paciente.id);

    setToggleLoading(false);

    if (error) {
      console.error('Error al actualizar personales:', error.message);
      alert('❌ No se pudo actualizar');
      return;
    }

    setPaciente({ ...paciente, personales: nuevoValor });
    alert(`✅ Ahora personales está ${nuevoValor ? 'ACTIVO' : 'DESACTIVADO'}`);
  };

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

  // 🔹 Editar registro (abrir modal)
  const handleEditar = (reg: Registro) => {
    setEditRegistro(reg);
    setEditMonto(reg.monto);
    setEditConcepto(reg.concepto || '');
  };

  // 🔹 Guardar edición
  const handleGuardarEdicion = async () => {
    if (!editRegistro) return;

    if (editMonto === '' || (editRegistro.tipo === 'cobro' && editConcepto.trim() === '')) {
      alert('Completa todos los campos');
      return;
    }

    if (editRegistro.tipo === 'deposito') {
      const { error } = await supabase
        .from('depositos_personales')
        .update({ monto: Number(editMonto) })
        .eq('id', editRegistro.id);
      if (error) {
        console.error('Error al actualizar depósito:', error.message);
        alert('❌ Error al actualizar depósito');
      }
    } else {
      const { error } = await supabase
        .from('cobros_personales')
        .update({ monto: Number(editMonto), concepto: editConcepto })
        .eq('id', editRegistro.id);
      if (error) {
        console.error('Error al actualizar cobro:', error.message);
        alert('❌ Error al actualizar cobro');
      }
    }

    setEditRegistro(null);
    setEditMonto('');
    setEditConcepto('');
    await fetchHistorial();
    await fetchSaldo();
    alert('✅ Registro actualizado');
  };

const generarPDFHistorial = () => {
  if (!paciente) return;

  const doc = new jsPDF('p', 'pt', 'a4');
  const margin = 40;

  // Títulos
  doc.setFontSize(24);
  doc.text(`Historial de Personales`, margin, 40);
  doc.setFontSize(18);
  doc.text(`Paciente: ${paciente.nombre}`, margin, 70);
  doc.text(`No. Expediente: ${paciente.numero_expediente}`, margin, 95);

  // Movimientos
  const movimientos = historial
    .map((r) => ({
      fecha: r.creado_en ? new Date(r.creado_en) : null,
      concepto: r.tipo === 'deposito' ? 'Deposito' : r.concepto ?? '',
      monto: r.monto !== undefined ? `$${r.monto.toFixed(2)}` : '$0.00',
      tipo: r.tipo,
    }))
    .filter((m) => m.fecha !== null) // eliminamos fechas inválidas
    .sort((a, b) => a.fecha!.getTime() - b.fecha!.getTime()); // de más antigua a más reciente

  autoTable(doc, {
    startY: 120,
    head: [['Fecha', 'Concepto', 'Monto']],
    body: movimientos.map((m) => [
      m.fecha!.toLocaleDateString(),
      m.concepto,
      m.monto,
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 14, textColor:[255,255,255] },
    theme: 'grid',
    didParseCell: function (data) {
      if (data.section === 'body') {
        const tipo = movimientos[data.row.index].tipo;
        if (tipo === 'deposito') {
          data.cell.styles.fillColor = [39, 60, 245]; // azul
        } else if (tipo === 'cobro') {
          data.cell.styles.fillColor = [138, 151, 255]; // naranja
        }
      }
    },
  });

  // Saldo actual al final
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 255); // saldo en azul
  doc.text(
    `Saldo Actual: $${saldo.toFixed(2)}`,
    margin,
    (doc as any).lastAutoTable.finalY + 40
  );

  const pdfUrl = doc.output('bloburl');
  window.open(pdfUrl);
};





  if (loading) return <p className="p-4">Cargando datos...</p>;
  if (!paciente) return <p className="p-4">Paciente no encontrado.</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto relative">

      <button
        onClick={() => router.push('/dashboard/personales')}
        className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Regresar
      </button>

      <h1 className="text-2xl font-bold mb-2">Detalle de {paciente.nombre}</h1>

      {/* Expediente + toggle */}
      <div className="flex items-center mb-4 space-x-4">
        <p className="text-sm text-gray-600">
          No. Expediente: {paciente.numero_expediente}
        </p>

        <div className="flex items-center">
          <span className="mr-2 font-semibold text-gray-700 text-sm">Personales</span>
          <button
            onClick={togglePersonales}
            disabled={toggleLoading}
            className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors duration-300 focus:outline-none shadow ${
              paciente.personales ? 'bg-green-500' : 'bg-gray-300'
            } ${toggleLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300 ${
                paciente.personales ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="ml-2 font-medium text-sm">
            {toggleLoading
              ? 'Procesando...'
              : paciente.personales
              ? '✅ Activado'
              : '❌ Desactivado'}
          </span>
        </div>
      </div>

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
            <button
              onClick={handleDeposito}
              disabled={isSaving}
              className={`w-full px-4 py-2 rounded transition ${isSaving
                  ? 'bg-yellow-500 cursor-not-allowed'
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
                      <td className="p-2 font-semibold">
                        ${reg.monto.toFixed(2)}
                      </td>
                      <td className="p-2">
                        {reg.tipo === 'cobro' ? reg.concepto : reg.evidencia_url && (
                          <a href={reg.evidencia_url} target="_blank" className="text-blue-600 underline">
                            Ver comprobante
                          </a>
                        )}
                      </td>
                      <td className="p-2 flex space-x-2">
                        <button onClick={() => handleEliminar(reg)} title="Eliminar">
                          <Trash className="w-5 h-5 text-red-600 hover:text-red-800" />
                        </button>
                        <button onClick={() => handleEditar(reg)} title="Editar">
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

      {/* Modal de edición */}
      {editRegistro && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 relative">
            <button className="absolute top-2 right-2" onClick={() => setEditRegistro(null)}>
              <X className="w-5 h-5 text-gray-700" />
            </button>
            <h2 className="text-lg font-semibold mb-4">Editar {editRegistro.tipo}</h2>
            <input
              type="number"
              placeholder="Monto"
              value={editMonto}
              onChange={(e) => setEditMonto(Number(e.target.value))}
              className="border px-3 py-2 rounded w-full mb-3"
            />
            {editRegistro.tipo === 'cobro' && (
              <input
                type="text"
                placeholder="Concepto"
                value={editConcepto}
                onChange={(e) => setEditConcepto(e.target.value)}
                className="border px-3 py-2 rounded w-full mb-3"
              />
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditRegistro(null)}
                className="px-4 py-2 rounded border hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
