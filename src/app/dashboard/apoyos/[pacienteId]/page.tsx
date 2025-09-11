"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash, X } from "lucide-react";
import { toast } from "react-hot-toast";

interface Apoyo {
  id: number;
  tipo: string;
  fecha: string;
  cantidad: number | null;
  comprobante_url: string | null;
}

export default function ApoyosPage() {
  const { pacienteId } = useParams();
  const router = useRouter();

  const [apoyos, setApoyos] = useState<Apoyo[]>([]);

  // Modal edición
  const [showModal, setShowModal] = useState(false);
  const [editApoyo, setEditApoyo] = useState<Apoyo | null>(null);
  const [tipo, setTipo] = useState("Efectivo");
  const [fecha, setFecha] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Agrega estos estados
const [paciente, setPaciente] = useState<{ nombre: string; numero_expediente: string } | null>(null);

// Cargar información del paciente
useEffect(() => {
  const fetchPaciente = async () => {
    const { data, error } = await supabase
      .from("pacientes")
      .select("nombre, numero_expediente")
      .eq("id", pacienteId)
      .single();

    if (error) {
      console.error("Error cargando paciente:", error);
    } else if (data) {
      setPaciente(data);
    }
  };

  fetchPaciente();
}, [pacienteId]);


  // Cargar historial
  useEffect(() => {
    const fetchApoyos = async () => {
      const { data } = await supabase
        .from("apoyos")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("fecha", { ascending: false });
      if (data) setApoyos(data);
    };
    fetchApoyos();
  }, [pacienteId]);

  // Preview del archivo
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (editApoyo?.comprobante_url) {
      const url = supabase.storage.from("comprobantes").getPublicUrl(editApoyo.comprobante_url).data.publicUrl;
      setPreview(url);
    } else setPreview(null);
  }, [file, editApoyo]);

  // ---------------- Registro nuevo apoyo ----------------
  const [regTipo, setRegTipo] = useState("Efectivo");
  const [regFecha, setRegFecha] = useState("");
  const [regCantidad, setRegCantidad] = useState("");
  const [regFile, setRegFile] = useState<File | null>(null);
  const [regPreview, setRegPreview] = useState<string | null>(null);
  const [isRegSaving, setIsRegSaving] = useState(false);

  useEffect(() => {
    if (regFile) {
      const url = URL.createObjectURL(regFile);
      setRegPreview(url);
      return () => URL.revokeObjectURL(url);
    } else setRegPreview(null);
  }, [regFile]);

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFecha) return toast.error("Selecciona una fecha");
    setIsRegSaving(true);

    let fileUrl: string | null = null;
    if (regFile) {
      const { data, error } = await supabase.storage
        .from("comprobantes")
        .upload(`pacientes/${pacienteId}/${Date.now()}-${regFile.name}`, regFile);
      if (error) {
        toast.error("Error subiendo archivo");
        setIsRegSaving(false);
        return;
      }
      fileUrl = data?.path;
    }

    const { data, error } = await supabase.from("apoyos").insert([
      {
        paciente_id: pacienteId,
        tipo: regTipo,
        fecha: regFecha,
        cantidad: regTipo !== "Fisico" ? Number(regCantidad) : null,
        comprobante_url: fileUrl,
      },
    ]).select();

    if (error) toast.error("Error al agregar apoyo");
    else {
      if (data) setApoyos((prev) => [...data, ...prev]);
      toast.success("Apoyo agregado correctamente");
      setRegTipo("Efectivo");
      setRegFecha("");
      setRegCantidad("");
      setRegFile(null);
      setRegPreview(null);
    }

    setIsRegSaving(false);
  };

  // ---------------- Editar apoyo ----------------
  const openEditModal = (apoyo: Apoyo) => {
    setEditApoyo(apoyo);
    setTipo(apoyo.tipo);
    setFecha(apoyo.fecha);
    setCantidad(apoyo.cantidad?.toString() || "");
    setFile(null);
    setShowModal(true);
  };

  const handleSaveChanges = async () => {
    if (!editApoyo) return;
    if (!fecha) return toast.error("Selecciona una fecha");

    setIsSaving(true);

    let fileUrl = editApoyo.comprobante_url || null;

    if (file) {
      const { data, error } = await supabase.storage
        .from("comprobantes")
        .upload(`pacientes/${pacienteId}/${Date.now()}-${file.name}`, file);
      if (error) {
        toast.error("Error subiendo archivo");
        setIsSaving(false);
        return;
      }
      fileUrl = data?.path;
    }

    const { error } = await supabase
      .from("apoyos")
      .update({
        tipo,
        fecha,
        cantidad: tipo !== "Fisico" ? Number(cantidad) : null,
        comprobante_url: fileUrl,
      })
      .eq("id", editApoyo.id);

    if (error) toast.error("Error al editar");
    else {
      setApoyos((prev) =>
        prev.map((a) =>
          a.id === editApoyo.id
            ? { ...a, tipo, fecha, cantidad: tipo !== "Fisico" ? Number(cantidad) : null, comprobante_url: fileUrl }
            : a
        )
      );
      toast.success("Apoyo editado correctamente");
      setShowModal(false);
      setEditApoyo(null);
      setFile(null);
      setPreview(null);
    }

    setIsSaving(false);
  };

  const handleEliminar = async (apoyo: Apoyo) => {
    if (!confirm("¿Eliminar este apoyo?")) return;
    const { error } = await supabase.from("apoyos").delete().eq("id", apoyo.id);
    if (error) toast.error("Error al eliminar");
    else {
      setApoyos((prev) => prev.filter((a) => a.id !== apoyo.id));
      toast.success("Apoyo eliminado correctamente");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => router.push("/dashboard/apoyos")}
        className="mb-4 text-blue-600 hover:underline flex items-center"
      >
        ← Regresar a Apoyos
      </button>

      <div className="mb-6">
  {paciente ? (
    <>
      <h2 className="text-xl font-semibold">Apoyo de {paciente.nombre}</h2>
      <p className="text-gray-600">Expediente: {paciente.numero_expediente}</p>
    </>
  ) : (
    <p>Cargando información del paciente...</p>
  )}
</div>
      <Tabs defaultValue="registro" className="w-full">
        <TabsList className="grid grid-cols-2 w-full mb-6">
          <TabsTrigger value="registro">Registro</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        {/* TAB REGISTRO */}
        <TabsContent value="registro">
          <form onSubmit={handleRegistro} className="space-y-6 bg-white p-6 rounded-2xl shadow">
            <div>
              <label className="block font-medium mb-2">Tipo</label>
              <select
                value={regTipo}
                onChange={(e) => setRegTipo(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Deposito">Depósito</option>
                <option value="Fisico">Físico</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-2">Fecha</label>
              <input
                type="date"
                value={regFecha}
                onChange={(e) => setRegFecha(e.target.value)}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>

            {regTipo !== "Fisico" && (
              <div>
                <label className="block font-medium mb-2">Cantidad</label>
                <input
                  type="number"
                  value={regCantidad}
                  onChange={(e) => setRegCantidad(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Ingrese cantidad"
                  required
                />
              </div>
            )}

            {/* Dropzone */}
            <div>
              <label className="block font-medium mb-2">Comprobante</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-8 h-8 mb-3 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12m-4 4h.01M12 16v4"
                    />
                  </svg>
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click para subir archivo</span> (.jpg, .png, .pdf)
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setRegFile(e.target.files?.[0] || null)}
                />
              </label>
              {regPreview && (
                <p className="mt-2 text-sm text-green-600">
                  Archivo seleccionado: {regFile ? regFile.name : "Archivo existente"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isRegSaving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {isRegSaving ? "Guardando..." : "Guardar Apoyo"}
            </button>
          </form>
        </TabsContent>

        {/* TAB HISTORIAL */}
        <TabsContent value="historial">
          <div className="space-y-4">
            {apoyos.length === 0 ? (
              <p className="text-gray-500">No hay apoyos registrados.</p>
            ) : (
              apoyos.map((apoyo) => (
                <div key={apoyo.id} className="p-4 bg-white shadow rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{apoyo.tipo}</p>
                    <p className="text-sm text-gray-600">{new Date(apoyo.fecha).toLocaleDateString()}</p>
                    {apoyo.cantidad !== null && <p className="text-sm text-gray-800">Cantidad: ${apoyo.cantidad}</p>}
                  </div>
                  <div className="flex items-center space-x-2">
                    {apoyo.comprobante_url && (
                      <a
                        href={supabase.storage.from("comprobantes").getPublicUrl(apoyo.comprobante_url).data.publicUrl}
                        target="_blank"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Ver comprobante
                      </a>
                    )}
                    <button onClick={() => openEditModal(apoyo)} className="text-blue-600 hover:text-blue-800">
                      <Pencil />
                    </button>
                    <button onClick={() => handleEliminar(apoyo)} className="text-red-600 hover:text-red-800">
                      <Trash />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal edición */}
      {showModal && editApoyo && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
            >
              <X />
            </button>
            <h2 className="text-xl font-bold mb-4">Editar Apoyo</h2>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Deposito">Depósito</option>
                  <option value="Fisico">Físico</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>

              {tipo !== "Fisico" && (
                <div>
                  <label className="block font-medium mb-1">Cantidad</label>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium mb-1">Comprobante</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-8 h-8 mb-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12m-4 4h.01M12 16v4"
                      />
                    </svg>
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold">Click para subir</span> o arrastra tu archivo
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                {preview && (
                  <p className="mt-2 text-sm text-green-600">
                    Archivo seleccionado: {file ? file.name : "Archivo existente"}
                  </p>
                )}
              </div>

              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
