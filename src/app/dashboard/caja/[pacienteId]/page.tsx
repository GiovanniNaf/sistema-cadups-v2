/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
// Agrega al inicio del archivo con los demás imports
import { jsPDF } from "jspdf";


interface Deuda {
  id: number;
  tipo: string;
  monto: number;
  pagado: boolean;
  fecha: string;
  monto_cubierto?: number;
  saldo_usado?: boolean;
}

interface Deposito {
  id: number;
  fecha: string;
  cantidad: number;
  comprobante_url: string;
  saldo_a_favor: number;
  montoaplicado: number;
}
export default function DetalleCajaPaciente() {
  const { pacienteId } = useParams();
  const pacienteIdNum = Number(pacienteId);

  // Estados para datos
  const [fechaCobro, setFechaCobro] = useState(
    new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })
  );
  const [nombrePaciente, setNombrePaciente] = useState('');
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [deudasPagadas, setDeudasPagadas] = useState<Deuda[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDeuda, setTotalDeuda] = useState(0);
  const [saldoAFavor, setSaldoAFavor] = useState(0);

  // Estados para cobro
  const [montoCobro, setMontoCobro] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [cargandoCobro, setCargandoCobro] = useState(false);

  // Estados para depósito
  const [mostrarModal, setMostrarModal] = useState(false);
  const [montoDeposito, setMontoDeposito] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesandoDeposito, setProcesandoDeposito] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState('');
  const [deudasSeleccionadas, setDeudasSeleccionadas] = useState<Record<number, boolean>>({});
  const [mensajeDeposito, setMensajeDeposito] = useState('');

  // Estado para pestañas activas
  const [tabActiva, setTabActiva] = useState<'deudas' | 'historial' | 'cortes' | 'depositos'>('deudas');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cortesCaja, setCortesCaja] = useState<any[]>([]);

  useEffect(() => {
    if (pacienteIdNum) fetchDatos();

  }, [pacienteIdNum]);



  const fetchDatos = async () => {
    setLoading(true);

    // Obtener datos del paciente
    const { data: pacienteData } = await supabase
      .from('pacientes')
      .select('nombre')
      .eq('id', pacienteIdNum)
      .single();

    setNombrePaciente(pacienteData?.nombre ?? '');

    const { data: cortesData } = await supabase
      .from('cortes_caja')
      .select('*')
      .eq('paciente_id', pacienteIdNum)
      .order('fecha', { ascending: false });

    setCortesCaja(cortesData ?? []);

    setLoading(false);


    // Obtener TODAS las deudas (pagadas y no pagadas)
    const { data: deudasData } = await supabase
      .from('deudas')
      .select('id, tipo, monto, pagado, fecha, saldo_usado, monto_cubierto')
      .eq('paciente_id', pacienteIdNum)
      .order('fecha', { ascending: true });

    // Filtrar y calcular deudas pendientes
    const deudasPendientes = deudasData?.filter(deuda => {
      if (deuda.pagado) return false;
      if (deuda.saldo_usado) {
        return (deuda.monto - (deuda.monto_cubierto || 0)) > 0;
      }
      return true;
    }).map(deuda => ({
      ...deuda,
      monto_mostrado: deuda.saldo_usado
        ? deuda.monto - (deuda.monto_cubierto || 0)
        : deuda.monto
    })) || [];

    setDeudas(deudasPendientes);

    // Calcular total de deuda PENDIENTE
    const total = deudasPendientes.reduce((acc, curr) =>
      acc + (curr.monto - (curr.monto_cubierto || 0)), 0);
    setTotalDeuda(total);

    // Obtener deudas pagadas (historial)
    const { data: deudasPagadasData } = await supabase
      .from('deudas')
      .select('id, tipo, monto, pagado, fecha')
      .eq('paciente_id', pacienteIdNum)
      .eq('pagado', true)
      .order('fecha', { ascending: false });

    setDeudasPagadas(deudasPagadasData ?? []);

    // Obtener depósitos
    const { data: depositosData } = await supabase
      .from('depositos')
      .select('*')
      .eq('paciente_id', pacienteIdNum)
      .order('fecha', { ascending: false });

    setDepositos(depositosData ?? []);

    // Calcular saldo a favor
    const saldoTotal = depositosData?.reduce((acc, curr) => acc + (curr.saldo_a_favor || 0), 0) ?? 0;
    setSaldoAFavor(saldoTotal);

    setLoading(false);
  };

  // Agrega esta función con las demás funciones del componente
  const generarReportePDF = () => {
    // Crear nuevo documento PDF
    const doc = new jsPDF();

    // Configuración inicial
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // Logo (opcional)
    // doc.addImage(logo, 'JPEG', margin, 10, 30, 15);

    // Título
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('CORTE DE CAJA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Información del paciente
    doc.setFontSize(12);
    doc.text(`Paciente: ${nombrePaciente}`, margin, yPos);
    yPos += 8;

    const fechaActual = new Date().toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Fecha del reporte: ${fechaActual}`, margin, yPos);
    yPos += 15;

    // Corte de caja pendiente
    const cortePendiente = cortesCaja.find(corte => corte.estado === false);
    if (cortePendiente) {
      doc.setFontSize(14);
      doc.setTextColor(200, 0, 0);
      doc.text('CORTE DE CAJA PENDIENTE', margin, yPos);
      yPos += 8;

      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text(`Monto total: $${cortePendiente.monto_total.toFixed(2)}`, margin, yPos);
      yPos += 8;

      const fechaCorte = new Date(cortePendiente.fecha).toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(`Fecha del corte: ${fechaCorte}`, margin, yPos);
      yPos += 15;
    }

    // Tabla de adeudos
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text('DETALLE DE ADEUDOS', margin, yPos);
    yPos += 10;

    // Encabezados de tabla
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
    doc.text('Concepto', margin + 5, yPos + 7);
    doc.text('Fecha', 70, yPos + 7);
    doc.text('Monto', pageWidth - margin - 25, yPos + 7, { align: 'right' });
    yPos += 12;

    // Filas de adeudos
    doc.setTextColor(0);
    let totalAdeudos = 0;

    deudas.forEach(deuda => {
      const montoPendiente = deuda.monto - (deuda.monto_cubierto || 0);
      totalAdeudos += montoPendiente;

      doc.text(deuda.tipo.charAt(0).toUpperCase() + deuda.tipo.slice(1), margin + 5, yPos + 7);

      const fechaDeuda = new Date(`${deuda.fecha}T12:00:00`).toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      doc.text(fechaDeuda, 70, yPos + 7);

      doc.text(`$${montoPendiente.toFixed(2)}`, pageWidth - margin - 5, yPos + 7, { align: 'right' });

      yPos += 8;

      // Verificar si necesita nueva página
      if (yPos > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPos = 20;
      }
    });

    // Total
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setDrawColor(200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL :', pageWidth - margin - 55, yPos + 7);
    doc.text(` $${totalAdeudos.toFixed(2)}`, pageWidth - margin - 5, yPos + 7, { align: 'right' });

    // Pie de página
    yPos += 20;
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Este documento es un reporte informativo de adeudos ', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;


    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Abrir en nueva pestaña
    const newWindow = window.open(pdfUrl, '_blank');
    // Liberar memoria después de que se abra
    if (newWindow) {
      newWindow.onload = () => {
        URL.revokeObjectURL(pdfUrl);
      };
    } else {
      // Fallback por si los popups están bloqueados
      alert('Por favor permite popups para ver el reporte');
      // Descargar como alternativa
      doc.save(`Reporte_Adeudos_${nombrePaciente.replace(/\s+/g, '_')}.pdf`);
      URL.revokeObjectURL(pdfUrl);
    }

  };

  const registrarCorteCaja = async () => {
    if (totalDeuda <= 0) {
      setMensajeError('No hay deuda pendiente para registrar corte');
      return;
    }

    setCargandoCobro(true);
    try {
      const { error } = await supabase
        .from('cortes_caja')
        .insert([{
          paciente_id: pacienteIdNum,
          monto_total: totalDeuda,
          estado: false // Puedes cambiar esto según tu lógica
        }]);

      if (error) throw error;

      // Mostrar mensaje de éxito
      setMensajeError(''); // Limpiar mensajes de error
      alert('Corte de caja registrado correctamente');

      // Opcional: refrescar datos si es necesario
      await fetchDatos();

    } catch (error) {
      console.error('Error al registrar corte de caja:', error);
      setMensajeError('Error al registrar corte de caja');
    } finally {
      setCargandoCobro(false);
    }
  };

  const calcularMontoPendiente = (deuda: Deuda) => {
    return Math.max(0, deuda.monto - (deuda.monto_cubierto || 0));
  };

  const registrarCobro = async () => {
    const monto = parseFloat(montoCobro);

    if (isNaN(monto) || monto <= 0) {
      setMensajeError('Ingresa un monto válido.');
      return;
    }

    setCargandoCobro(true);
    setMensajeError('');

    try {
      let saldoUtilizado = 0;
      let pagadoCompletamente = false;

      // 1. Usar saldo a favor si existe
      if (saldoAFavor > 0) {
        saldoUtilizado = Math.min(monto, saldoAFavor);
        pagadoCompletamente = saldoUtilizado >= monto;

        // Actualizar saldo a favor en los depósitos
        let saldoPorAplicar = saldoUtilizado;
        const depositosOrdenados = [...depositos].sort((a, b) =>
          new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

        for (const deposito of depositosOrdenados) {
          if (saldoPorAplicar <= 0) break;

          const saldoDisponible = deposito.saldo_a_favor || 0;
          if (saldoDisponible <= 0) continue;

          const saldoUsado = Math.min(saldoDisponible, saldoPorAplicar);
          const nuevoSaldo = saldoDisponible - saldoUsado;

          const { error: updateError } = await supabase
            .from('depositos')
            .update({ saldo_a_favor: nuevoSaldo })
            .eq('id', deposito.id);

          if (updateError) throw new Error('Error al actualizar saldo a favor');
          saldoPorAplicar -= saldoUsado;
        }
      }

      // 2. Registrar UNA SOLA deuda
      const { error: deudaError } = await supabase.from('deudas').insert([{
        paciente_id: pacienteIdNum,
        tipo: 'tienda', // Siempre será "Tienda"
        monto: monto,
        pagado: pagadoCompletamente,
        fecha: fechaCobro, // Usar la fecha seleccionada
        saldo_usado: saldoUtilizado > 0,
        monto_cubierto: saldoUtilizado
      }]);

      if (deudaError) throw new Error('Error al registrar deuda');

      // 3. Actualizar UI
      setMontoCobro('');
      await fetchDatos();
      setMensajeError('');

    } catch (error) {
      console.error('Error al registrar cobro:', error);
      setMensajeError('Ocurrió un error al registrar el cobro');
    } finally {
      setCargandoCobro(false);
    }
  };

  const manejarArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArchivo(file);
      const url = URL.createObjectURL(file);
      setVistaPrevia(url);
    }
  };

  const subirComprobante = async () => {
    if (!archivo) return '';
    const nombre = `comprobante_${pacienteIdNum}_${Date.now()}`;
    const { data, error } = await supabase.storage
      .from('comprobantes')
      .upload(nombre, archivo);

    if (error || !data) return '';
    return supabase.storage.from('comprobantes').getPublicUrl(data.path).data.publicUrl;
  };

  const manejarCambioMontoDeposito = (e: React.ChangeEvent<HTMLInputElement>) => {
    const monto = e.target.value;
    setMontoDeposito(monto);

    if (!monto) {
      setMensajeDeposito('');
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum)) return;

    // Si no hay deudas seleccionadas
    if (Object.values(deudasSeleccionadas).filter(Boolean).length === 0) {
      setMensajeDeposito(
        `El depósito de $${montoNum.toFixed(2)} se registrará como saldo a favor`
      );
      return;
    }

    // Si hay deudas seleccionadas
    const montoPendienteReal = deudas.reduce((total, deuda) => {
      if (!deudasSeleccionadas[deuda.id]) return total;
      return total + Math.max(0, deuda.monto - (deuda.monto_cubierto || 0));
    }, 0);

    if (montoNum >= montoPendienteReal) {
      const diferencia = montoNum - montoPendienteReal;
      setMensajeDeposito(
        `La cantidad cubre completamente la deuda pendiente` +
        (diferencia > 0 ? ` y genera saldo a favor de $${diferencia.toFixed(2)}` : '')
      );
    } else {
      const falta = montoPendienteReal - montoNum;
      setMensajeDeposito(
        `La cantidad no cubre la deuda pendiente. Falta por pagar $${falta.toFixed(2)}`
      );
    }
  };

  const toggleSeleccionDeuda = (deudaId: number) => {
    setDeudasSeleccionadas(prev => ({
      ...prev,
      [deudaId]: !prev[deudaId]
    }));
  };

  const registrarDeposito = async () => {
    if (!archivo || !archivo.name) {
      setMensajeError('El comprobante no es válido');
      return;
    }

    const montoNum = parseFloat(montoDeposito);
    if (isNaN(montoNum)) {
      setMensajeError('Monto no válido');
      return;
    }

    setProcesandoDeposito(true);
    setMensajeError('');

    try {
      const comprobanteUrl = await subirComprobante();
      if (!comprobanteUrl) {
        throw new Error('No se pudo subir el comprobante');
      }

      const deudasAPagar = deudas.filter(d => deudasSeleccionadas[d.id]);
      let montoAplicado = 0;
      let saldoFavor = montoNum;

      // Solo intentar aplicar a deudas si hay deudas seleccionadas
      if (deudasAPagar.length > 0) {
        let totalPendiente = 0;
        deudasAPagar.forEach(deuda => {
          totalPendiente += Math.max(0, deuda.monto - (deuda.monto_cubierto || 0));
        });

        montoAplicado = Math.min(montoNum, totalPendiente);
        saldoFavor = Math.max(0, montoNum - totalPendiente);

        // Aplicar a deudas seleccionadas
        if (montoAplicado > 0) {
          let restante = montoAplicado;

          for (const deuda of deudasAPagar) {
            if (restante <= 0) break;

            const pendiente = deuda.monto - (deuda.monto_cubierto || 0);
            if (pendiente <= 0) continue;

            const aPagar = Math.min(pendiente, restante);
            const nuevoCubierto = (deuda.monto_cubierto || 0) + aPagar;
            const pagado = nuevoCubierto >= deuda.monto;

            const { error: deudaError } = await supabase
              .from('deudas')
              .update({
                monto_cubierto: nuevoCubierto,
                pagado: pagado
              })
              .eq('id', deuda.id);

            if (deudaError) throw deudaError;
            restante -= aPagar;
          }
        }
      }

      // Registrar el depósito (siempre se registra, aunque no haya deudas)
      const { error: depositoError } = await supabase
        .from('depositos')
        .insert({
          paciente_id: pacienteIdNum,
          cantidad: montoNum,
          comprobante_url: comprobanteUrl,
          fecha: new Date().toISOString(),
          saldo_a_favor: saldoFavor,
          monto_aplicado: montoAplicado
        });

      if (depositoError) throw depositoError;

      // Actualizar corte pendiente si existe
      const { data: cortesPendientes } = await supabase
        .from('cortes_caja')
        .select('id')
        .eq('paciente_id', pacienteIdNum)
        .eq('estado', false)
        .order('fecha', { ascending: false })
        .limit(1);

      if (cortesPendientes && cortesPendientes.length > 0) {
        const corteId = cortesPendientes[0].id;
        const { error: updateError } = await supabase
          .from('cortes_caja')
          .update({ estado: true })
          .eq('id', corteId);

        if (updateError) throw updateError;
      }

      setMostrarModal(false);
      setMontoDeposito('');
      setArchivo(null);
      setVistaPrevia('');
      setDeudasSeleccionadas({});
      await fetchDatos();

    } catch (error) {
      console.error('Error en registrarDeposito:', error);
      setMensajeError('Ocurrió un error al registrar el deposito');
    } finally {
      setProcesandoDeposito(false);
    }
  };

  if (loading) return <p className="p-4">Cargando información del paciente...</p>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header con información del paciente */}
      {/* Header con información del paciente */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Detalle del paciente</h1>
            <p className="text-xl font-semibold text-gray-700 mt-2">{nombrePaciente}</p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Link href="/dashboard/caja" className="text-blue-600 hover:text-blue-800 underline">
              ← Volver a Caja
            </Link>
            {/* Botón para generar PDF - Solo visible si hay corte pendiente */}
            {cortesCaja.some(corte => corte.estado === false) && (
              <button
                onClick={generarReportePDF}
                className={`flex items-center text-sm px-3 py-1 rounded-md ${cortesCaja.some(corte => corte.estado === false)
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generar Reporte PDF
              </button>
            )}
          </div>
        </div>

        {saldoAFavor > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg inline-block">
            <p className="text-green-700 font-semibold">
              Saldo a favor: <span className="font-bold">${saldoAFavor.toFixed(2)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Tabs de navegación */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setTabActiva('deudas')}
            className={`py-2 px-4 font-medium text-sm rounded-t-lg ${tabActiva === 'deudas' ? 'bg-white border border-b-0 border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Deudas Pendientes
          </button>
          <button
            onClick={() => setTabActiva('historial')}
            className={`py-2 px-4 font-medium text-sm rounded-t-lg ${tabActiva === 'historial' ? 'bg-white border border-b-0 border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Historial de Pagos
          </button>
          <button
            onClick={() => setTabActiva('depositos')}
            className={`py-2 px-4 font-medium text-sm rounded-t-lg ${tabActiva === 'depositos' ? 'bg-white border border-b-0 border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Depósitos
          </button>

          <button
            onClick={() => setTabActiva('cortes')}
            className={`py-2 px-4 font-medium text-sm rounded-t-lg ${tabActiva === 'cortes' ? 'bg-white border border-b-0 border-gray-200 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Cortes de Caja
          </button>
        </nav>
      </div>

      {/* Contenido de las tabs */}
      <div className="mb-8">
        {/* Tab Deudas Pendientes */}
        {tabActiva === 'deudas' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Deudas Pendientes</h2>

              {deudas.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No hay deudas pendientes registradas.
                </div>
              ) : (
                <div className="space-y-4">
                  {deudas.map((d) => {
                    const montoPendiente = calcularMontoPendiente(d);
                    const porcentajePagado = ((d.monto_cubierto || 0) / d.monto) * 100;

                    return (
                      <div key={d.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-800 capitalize">
                              {d.tipo}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-MX', {
                                timeZone: 'America/Mexico_City'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">
                              ${montoPendiente.toFixed(2)}
                              {d.saldo_usado && (
                                <span className="text-xs font-normal text-gray-500 ml-1">
                                  (de ${d.monto.toFixed(2)})
                                </span>
                              )}
                            </p>
                            {d.saldo_usado && (
                              <p className="text-xs text-gray-500">
                                Saldo aplicado: ${(d.monto_cubierto || 0).toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>

                        {montoPendiente > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${porcentajePagado}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 text-right">
                              {porcentajePagado.toFixed(0)}% completado
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {deudas.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-bold text-red-700 text-lg text-center">
                    Total de deuda pendiente: ${totalDeuda.toFixed(2)}
                  </p>
                  <button
                    onClick={registrarCorteCaja}
                    disabled={cortesCaja.some(corte => corte.estado === false)} // Deshabilitar si existe corte pendiente
                    className={`mt-3 w-full text-white py-2 px-4 rounded-md transition-colors ${cortesCaja.some(corte => corte.estado === false)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                  >
                    {cortesCaja.some(corte => corte.estado === false)
                      ? 'Ya existe un corte pendiente'
                      : 'Registrar Corte de Caja'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tabActiva === 'cortes' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Historial de Cortes de Caja</h2>

              {cortesCaja.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No hay cortes de caja registrados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cortesCaja.map((corte) => (
                        <tr key={corte.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(corte.fecha).toLocaleString('es-MX', {
                              timeZone: 'America/Mexico_City',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">${corte.monto_total.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${corte.estado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {corte.estado ? 'Procesado' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Historial de Pagos */}
        {tabActiva === 'historial' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Historial de Pagos</h2>

              {deudasPagadas.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No hay deudas pagadas registradas.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deudasPagadas.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap capitalize">{d.tipo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">${d.monto.toFixed(2)}</td>
                          <td className="text-sm text-gray-500">
                            {new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-MX', {
                              timeZone: 'America/Mexico_City',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Depósitos */}
        {tabActiva === 'depositos' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Historial de Depósitos</h2>

              {depositos.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No hay depósitos registrados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo a favor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comprobante</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {depositos.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(d.fecha).toLocaleDateString('es-MX', {
                              timeZone: 'America/Mexico_City',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">${d.cantidad.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">${d.saldo_a_favor?.toFixed(2) || '0.00'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {d.comprobante_url ? (
                              <a
                                href={d.comprobante_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                Ver comprobante
                              </a>
                            ) : (
                              <span className="text-gray-400">Sin comprobante</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sección de acciones (Cobro y Depósito) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Acciones</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Card de Cobro */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">Registrar Cobro</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaCobro}
                  onChange={(e) => setFechaCobro(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                <input
                  type="number"
                  value={montoCobro}
                  onChange={(e) => setMontoCobro(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej. 120.00"
                />
              </div>
            </div>

            {mensajeError && <p className="text-red-600 mt-2 text-sm">{mensajeError}</p>}

            <button
              onClick={registrarCobro}
              disabled={cargandoCobro || cortesCaja.some(corte => corte.estado === false)}
              className={`mt-4 w-full text-white py-2 px-4 rounded-md transition-colors ${cargandoCobro || cortesCaja.some(corte => corte.estado === false)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
                }`}
            >
              {cargandoCobro
                ? 'Registrando...'
                : cortesCaja.some(corte => corte.estado === false)
                  ? 'Corte pendiente - No se puede cobrar'
                  : 'Registrar Cobro'}
            </button>
          </div>

          {/* Card de Depósito */}
          <div className="border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">Registrar Depósito</h3>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Registra un depósito para abonar a la deuda del paciente.
                </p>
              </div>
            </div>

            <button
              onClick={() => setMostrarModal(true)}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Realizar Depósito
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Depósito */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Registrar Depósito</h2>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Depositar</label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={montoDeposito}
                  onChange={manejarCambioMontoDeposito}
                  placeholder="Ej. 120.00"
                />
              </div>

              {deudas.length > 0 && (
                <div>
                  <h3 className="font-medium text-sm text-gray-700 mb-2">Selecciona las deudas a pagar</h3>
                  <div className="border border-gray-200 rounded-md p-3 max-h-40 overflow-y-auto">
                    {deudas.map(deuda => {
                      const montoPendiente = calcularMontoPendiente(deuda);
                      const porcentajePagado = ((deuda.monto_cubierto || 0) / deuda.monto) * 100;

                      return (
                        <div key={deuda.id} className="flex items-center mb-3 last:mb-0">
                          <input
                            type="checkbox"
                            id={`deuda-${deuda.id}`}
                            checked={!!deudasSeleccionadas[deuda.id]}
                            onChange={() => toggleSeleccionDeuda(deuda.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={montoPendiente <= 0}
                          />
                          <label htmlFor={`deuda-${deuda.id}`} className="ml-2 block text-sm text-gray-700 flex-1">
                            <div className="flex justify-between">
                              <span className="capitalize">
                                {deuda.tipo}: <span className="font-medium">${montoPendiente.toFixed(2)} pendiente</span>
                              </span>
                              {montoPendiente > 0 && (
                                <span className="text-xs text-gray-500">
                                  {porcentajePagado.toFixed(0)}% completado
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full"
                                style={{ width: `${porcentajePagado}%` }}
                              ></div>
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {montoDeposito && (
                <div className={`p-3 rounded-md ${mensajeDeposito.includes('no cubre') ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className={mensajeDeposito.includes('no cubre') ? 'text-yellow-700' : 'text-green-700'}>
                    {mensajeDeposito}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante (png, jpg, pdf, jpeg)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    {vistaPrevia ? (
                      <div className="text-center">
                        {archivo?.type.includes('image') ? (
                          <img src={vistaPrevia} alt="Vista previa" className="mx-auto max-h-40" />
                        ) : (
                          <div className="bg-gray-100 p-4 rounded-md">
                            <p className="text-gray-700">Documento seleccionado</p>
                            <p className="text-sm text-gray-500 truncate">{archivo?.name}</p>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setArchivo(null);
                            setVistaPrevia('');
                          }}
                          className="mt-2 text-sm text-red-600 hover:text-red-800"
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="comprobante"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                          >
                            <span>Subir un archivo</span>
                            <input
                              id="comprobante"
                              name="comprobante"
                              type="file"
                              className="sr-only"
                              accept=".png,.jpg,.jpeg,.pdf"
                              onChange={manejarArchivo}
                            />
                          </label>
                          <p className="pl-1">o arrastrar y soltar</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, PDF hasta 10MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {mensajeError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700">{mensajeError}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setMontoDeposito('');
                  setArchivo(null);
                  setVistaPrevia('');
                  setDeudasSeleccionadas({});
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={registrarDeposito}
                disabled={procesandoDeposito || !montoDeposito || parseFloat(montoDeposito) <= 0}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
              >
                {procesandoDeposito ? 'Procesando...' : 'Registrar Depósito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

