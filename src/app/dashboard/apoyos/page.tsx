/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Paciente {
  id: number;
  nombre: string;
  edad: number;
  numero_expediente: string;
  apoyos_count?: number;

}

interface ApoyoReporte {
  id: number;
  tipo: string;
  fecha: string;
  cantidad: number | null;
  comprobante_url: string | null;
  paciente_nombre: string;
  paciente_expediente: string;
}

export default function ApoyosPage() {
  const [tab, setTab] = useState<"pacientes" | "reporte">("pacientes");
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [search, setSearch] = useState("");

  const [apoyos, setApoyos] = useState<ApoyoReporte[]>([]);
  const [loadingReporte, setLoadingReporte] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(
    new Date().toISOString().slice(0, 7) // yyyy-mm
  );
  const [anio, mes] = mesSeleccionado.split("-").map(Number);
  const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate(); // último día del mes
  const ultimoDiaStr = `${anio}-${String(mes).padStart(2, "0")}-${ultimoDia}`;



  // --- Cargar Pacientes ---
  useEffect(() => {
    const fetchPacientes = async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nombre, edad, numero_expediente, apoyos:apoyos(count)")
        .order("nombre", { ascending: true });

      if (error) {
        console.error(error.message);
        setPacientes([]);
      } else {
        // Mapear para agregar número de apoyos
     
        const pacientesConConteo = data?.map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          edad: p.edad,
          numero_expediente: p.numero_expediente,
          apoyos_count: p.apoyos[0]?.count || 0,
        }));
        setPacientes(pacientesConConteo || []);
      }
      setLoadingPacientes(false);
    };

    fetchPacientes();
  }, []);

  const pacientesFiltrados = pacientes.filter((p) =>
    p.nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  );

  // --- Cargar Reporte ---
  useEffect(() => {
    const fetchReporte = async () => {
      setLoadingReporte(true);


      // Usamos la vista apoyos_con_paciente
      const { data, error } = await supabase
        .from("apoyos_con_paciente")
        .select("*")
        .gte("fecha", primerDia)
        .lte("fecha", ultimoDiaStr)
        .order("fecha", { ascending: true });

      if (error) {
        console.error(error.message);
        setApoyos([]);
      } else {
        setApoyos(data as ApoyoReporte[]);
      }
      setLoadingReporte(false);
    };

    fetchReporte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSeleccionado]);

  // --- Generar PDF ---
  const generarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Reporte de Apoyos", 14, 20);

    doc.setFontSize(12);
    doc.text(`Mes: ${mes} / Año: ${anio}`, 14, 30);

    const tipos = ["Efectivo", "Deposito", "Fisico"];
    let y = 36;

    tipos.forEach((tipo) => {
      const apoyosTipo = apoyos.filter((a) => a.tipo === tipo);
      if (apoyosTipo.length === 0) return;

      doc.setFontSize(14);
      doc.setTextColor("#1D4ED8");
      doc.text(`${tipo} (${apoyosTipo.length})`, 14, y);
      y += 4;

      const rows = apoyosTipo.map((a) => [
        a.fecha,
        a.paciente_nombre,
        a.paciente_expediente,
        a.cantidad !== null ? `$${a.cantidad}` : "-",
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Paciente", "Expediente", "Cantidad"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 11 },
        margin: { left: 14, right: 14 },
      });

      // Total
      const total = apoyosTipo
        .filter((a) => a.cantidad)
        .reduce((sum, a) => sum + (a.cantidad || 0), 0);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      y = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(12);
      doc.setTextColor("#000000");
      if (tipo !== "Fisico") doc.text(`Total ${tipo}: $${total}`, 14, y);
      y += 10;
    });

    // Abrir en nueva ventana
    // Abrir en nueva ventana
    const pdfUrl = doc.output("bloburl");
    window.open(pdfUrl, "_blank");
  };


  const generarPDFPacientesSinApoyo = async (mesSeleccionado: string) => {
    const [anio, mes] = mesSeleccionado.split("-").map(Number);
    const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const ultimoDiaStr = `${anio}-${String(mes).padStart(2, "0")}-${ultimoDia}`;

    // --- Traer pacientes ---
    const { data: pacientesData, error: errorPacientes } = await supabase
      .from("pacientes")
      .select("id, nombre, numero_expediente,fecha_ingreso");

    if (errorPacientes) {
      console.error("Error cargando pacientes:", errorPacientes.message);
      return;
    }

    // --- Traer apoyos del mes ---
    const { data: apoyosMes, error: errorApoyos } = await supabase
      .from("apoyos")
      .select("paciente_id")
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDiaStr);

    if (errorApoyos) {
      console.error("Error cargando apoyos:", errorApoyos.message);
      return;
    }

    const idsConApoyo = apoyosMes?.map((a: any) => a.paciente_id) || [];

    // --- Filtrar pacientes sin apoyo ---
  const pacientesSinApoyo = pacientesData
  ?.filter((p: any) => !idsConApoyo.includes(p.id))
  .sort((a: any, b: any) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  );



    if (!pacientesSinApoyo || pacientesSinApoyo.length === 0) {
      alert("Todos los pacientes registraron apoyo este mes.");
      return;
    }

    // --- Generar PDF ---
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Pacientes sin apoyo del mes", 14, 20);
    doc.setFontSize(12);
    doc.text(`Mes: ${mes} / Año: ${anio}`, 14, 30);

  
    const rows = pacientesSinApoyo.map((p: any) => [
      p.nombre,
      p.numero_expediente,
      p.fecha_ingreso,
    ]);

    autoTable(doc, {
      startY: 36,
      head: [["Nombre", "Expediente", "Fecha de Ingreso"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [220, 53, 69], textColor: 255 }, // rojo encabezado
      styles: { fontSize: 11 },
      margin: { left: 14, right: 14 },
    });

    // Abrir PDF en nueva ventana
    const pdfUrl = doc.output("bloburl");
    window.open(pdfUrl, "_blank");
  };



  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Apoyos</h1>

      {/* Tabs */}
      <div className="flex mb-6 space-x-4">
        <button
          className={`px-4 py-2 rounded-lg ${tab === "pacientes"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700"
            }`}
          onClick={() => setTab("pacientes")}
        >
          Pacientes
        </button>
        <button
          className={`px-4 py-2 rounded-lg ${tab === "reporte"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700"
            }`}
          onClick={() => setTab("reporte")}
        >
          Reporte
        </button>
      </div>

      {tab === "pacientes" && (
        <>
          {/* Buscador */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => generarPDFPacientesSinApoyo(mesSeleccionado)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Abrir reporte de Pendientes
            </button>
          </div>


          {loadingPacientes ? (
            <p>Cargando pacientes...</p>
          ) : pacientesFiltrados.length === 0 ? (
            <p>No se encontraron pacientes.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pacientesFiltrados.map((paciente) => (
                <div
                  key={paciente.id}
                  className="bg-white shadow-md rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition"
                >
                  <h2 className="text-xl font-semibold mb-2">{paciente.nombre}</h2>
                  <p className="text-gray-600 text-sm">
                    Expediente:{" "}
                    <span className="font-medium">{paciente.numero_expediente}</span>
                  </p>
                  <p className="text-gray-600 text-sm">
                    Edad: <span className="font-medium">{paciente.edad} años</span>
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      {paciente.apoyos_count} apoyos
                    </span>

                    <a
                      href={`/dashboard/apoyos/${paciente.id}`}
                      className="text-blue-600 text-sm font-medium hover:underline"
                    >
                      Ver detalles →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "reporte" && (
        <div className="bg-white p-6 rounded-2xl shadow">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
            <div className="flex items-center space-x-2 mb-2 sm:mb-0">
              <label className="font-medium">Seleccionar mes:</label>
              <input
                type="month"
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="p-2 border rounded-lg"
              />
            </div>
            <button
              onClick={generarPDF}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Abrir PDF
            </button>
          </div>

          {loadingReporte ? (
            <p>Cargando reporte...</p>
          ) : apoyos.length === 0 ? (
            <p>No hay apoyos registrados en este mes.</p>
          ) : (
            <div className="space-y-6">
              {(["Efectivo", "Deposito", "Fisico"] as const).map((tipo) => {
                const filtrados = apoyos.filter((a) => a.tipo === tipo);
                if (filtrados.length === 0) return null;

                const total =
                  tipo !== "Fisico"
                    ? filtrados.reduce((sum, a) => sum + (a.cantidad || 0), 0)
                    : null;

                return (
                  <div key={tipo} className="border rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-blue-800">
                        {tipo} ({filtrados.length})
                      </h3>
                      {total !== null && (
                        <span className="text-sm font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                          Total: ${total}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto border-collapse border border-gray-300 text-center">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border px-3 py-2">Paciente</th>
                            <th className="border px-3 py-2">Expediente</th>
                            <th className="border px-3 py-2">Fecha</th>
                            <th className="border px-3 py-2">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtrados.map((a) => (
                            <tr key={a.id}>
                              <td className="border px-3 py-2">{a.paciente_nombre}</td>
                              <td className="border px-3 py-2">{a.paciente_expediente}</td>
                              <td className="border px-3 py-2">{a.fecha}</td>
                              <td className="border px-3 py-2">{a.cantidad ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
