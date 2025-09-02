
'use client';


import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";



interface Paciente {
    id: number;
    nombre: string;
    numero_expediente: string;
    edad: number;
}

interface NotaEvolucion {
    id: number;
    sexo: string;
    fecha_elaboracion: string;
    hora: string;
    ta: string;
    fc: number;
    fr: number;
    tc: number;
    oxm: number;
    descripcion: string;
}

interface Medico {
    nombre: string;
    cedula: string;
}



const getLogoBase64 = async (url: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};


export const generarPDFNotaProfesional = async (
    nota: NotaEvolucion,
    medico: Medico,
    paciente: Paciente,
    logoBase64: string
) => {
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- Logo más grande ---
    doc.addImage(logoBase64, "PNG", 20, 10, 50, 50);

    // --- Título ---
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("NOTA DE EVOLUCIÓN MÉDICA", pageWidth / 2, 40, { align: "center" });

    // --- Tabla de información del paciente (Nombre | Edad | Sexo | No. Expediente) ---
    autoTable(doc, {
        startY: 70,
        head: [["Nombre", "Edad", "Sexo", "No. Expediente"]],
        body: [[paciente.nombre, `${paciente.edad}`, nota.sexo, paciente.numero_expediente]],
        theme: "grid",
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
        styles: { fontSize: 11, textColor: [0, 0, 0] },
    });

    // --- Tabla de fecha y hora ---
    autoTable(doc, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startY: (doc as any).lastAutoTable.finalY + 5,
        head: [["Fecha de Elaboración", "Hora"]],
        body: [[nota.fecha_elaboracion, nota.hora]],
        theme: "grid",
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
        styles: { fontSize: 11, textColor: [0, 0, 0] },
    });

    // --- Tabla de signos vitales ---
    autoTable(doc, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["Signos Vitales", "Valor"]],
        body: [
            ["TA (Presión Arterial)", `${nota.ta} mmHg`],
            ["FC (Frecuencia Cardiaca)", `${nota.fc} lpm`],
            ["FR (Frecuencia Respiratoria)", `${nota.fr} rpm`],
            ["TC (Temperatura Corporal)", `${nota.tc} °C`],
            ["OXM (Oxigenación)", `${nota.oxm} %`],
        ],
        theme: "grid",
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
        styles: { fontSize: 11, textColor: [0, 0, 0] },
    });

    // --- Tabla de descripción ---
    autoTable(doc, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["Descripción"]],
        body: [[nota.descripcion]],
        theme: "grid",
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
        styles: { fontSize: 11, textColor: [0, 0, 0] },
    });

    // --- Firma del médico centrada ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firmaY = (doc as any).lastAutoTable.finalY + 30;
    const centerX = pageWidth / 2;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`${medico.nombre}`, centerX, firmaY, { align: "center" });
    doc.line(centerX - 60, firmaY + 15, centerX + 60, firmaY + 15);
    doc.text("NOMBRE Y FIRMA DEL MEDICO", centerX, firmaY + 30, { align: "center" });
    doc.text(`CED.PROF: ${medico.cedula}`, centerX, firmaY + 40, { align: "center" });


    // --- Pie de página ---
    doc.setFontSize(9);
    doc.text(
        "e-mail: armaexad@gmail.com | www.unidosparasiempre.org",
        pageWidth / 2,
        770,
        { align: "center" }
    );
    doc.text(
        "Libramiento Poniente Norte No. 13 Ocozocoautla, Chiapas | Teléfono: 968 68 81594",
        pageWidth / 2,
        780,
        { align: "center" }
    );

    // --- Abrir PDF en nueva ventana ---
    window.open(doc.output("bloburl"), "_blank");
};



const PacienteDetalle = () => {
    const { pacienteId } = useParams<{ pacienteId: string }>();

    const [paciente, setPaciente] = useState<Paciente | null>(null);
    const [notas, setNotas] = useState<NotaEvolucion[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Formulario para nueva nota
    const [form, setForm] = useState({
        sexo: '',
        fecha_elaboracion: '',
        hora: '',
        ta: '',
        fc: '',
        fr: '',
        tc: '',
        oxm: '',
        descripcion: '',
    });

    // Modal edición
    const [modalOpen, setModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(form);
    const [editandoId, setEditandoId] = useState<number | null>(null);

    // Cargar paciente y notas
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            const { data: pacienteData } = await supabase
                .from('pacientes')
                .select('id, nombre, numero_expediente, edad')
                .eq('id', pacienteId)
                .single();

            setPaciente(pacienteData);

            const { data: notasData } = await supabase
                .from('nota_evolucion')
                .select('*')
                .eq('paciente_id', pacienteId)
                .order('fecha_elaboracion', { ascending: false })
                .order('hora', { ascending: false });

            setNotas(notasData || []);
            setLoading(false);
        };

        if (pacienteId) fetchData();
    }, [pacienteId]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleEditChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validación obligatoria
        if (Object.values(form).some((val) => !val)) {
            alert('Todos los campos son obligatorios.');
            return;
        }

        const { error } = await supabase.from('nota_evolucion').insert({
            paciente_id: pacienteId,
            ...form,
            fc: parseInt(form.fc),
            fr: parseInt(form.fr),
            tc: parseFloat(form.tc),
            oxm: parseInt(form.oxm),
        });

        if (error) {
            console.error(error);
            return;
        }

        refrescarNotas();
        setForm({
            sexo: '',
            fecha_elaboracion: '',
            hora: '',
            ta: '',
            fc: '',
            fr: '',
            tc: '',
            oxm: '',
            descripcion: '',
        });
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (Object.values(editForm).some((val) => !val)) {
            alert('Todos los campos son obligatorios.');
            return;
        }

        const { error } = await supabase
            .from('nota_evolucion')
            .update({
                ...editForm,
                fc: parseInt(editForm.fc),
                fr: parseInt(editForm.fr),
                tc: parseFloat(editForm.tc),
                oxm: parseInt(editForm.oxm),
            })
            .eq('id', editandoId);

        if (error) {
            console.error(error);
            return;
        }

        setModalOpen(false);
        setEditandoId(null);
        refrescarNotas();
    };

    const refrescarNotas = async () => {
        const { data: notasData } = await supabase
            .from('nota_evolucion')
            .select('*')
            .eq('paciente_id', pacienteId)
            .order('fecha_elaboracion', { ascending: false })
            .order('hora', { ascending: false });

        setNotas(notasData || []);
    };

    const handleEdit = (nota: NotaEvolucion) => {
        setEditandoId(nota.id);
        setEditForm({
            sexo: nota.sexo,
            fecha_elaboracion: nota.fecha_elaboracion,
            hora: nota.hora,
            ta: nota.ta,
            fc: nota.fc.toString(),
            fr: nota.fr.toString(),
            tc: nota.tc.toString(),
            oxm: nota.oxm.toString(),
            descripcion: nota.descripcion,
        });
        setModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que quieres eliminar esta nota?')) return;

        const { error } = await supabase.from('nota_evolucion').delete().eq('id', id);

        if (error) {
            console.error(error);
            return;
        }

        setNotas(notas.filter((n) => n.id !== id));
    };

    if (loading) return <p className="p-6">Cargando...</p>;

    return (
        <div className="p-6">
            <button
                onClick={() => router.push('/dashboard/medico')}
                className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
                ← Regresar
            </button>

            {paciente && (
                <div className="mb-6 bg-white shadow-md rounded-lg p-5 border border-gray-200">
                    <h1 className="text-2xl font-bold">{paciente.nombre}</h1>
                    <p className="text-gray-600">Expediente: {paciente.numero_expediente}</p>
                    <p className="text-gray-600">Edad: {paciente.edad}</p>
                </div>
            )}


            {/* Formulario Nueva Nota */}
            <div className="mb-6 bg-gray-50 p-5 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Agregar Nota de Evolución</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select name="sexo" value={form.sexo} onChange={handleChange} className="border p-2 rounded" required>
                        <option value="">Sexo *</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                    </select>

                    <input type="date" name="fecha_elaboracion" value={form.fecha_elaboracion} onChange={handleChange} className="border p-2 rounded" required />

                    <input type="time" name="hora" value={form.hora} onChange={handleChange} className="border p-2 rounded" required />

                    <input type="text" name="ta" placeholder="TA (Ej. 120/80)" value={form.ta} onChange={handleChange} className="border p-2 rounded" required />

                    <input type="number" name="fc" placeholder="FC (lpm)" value={form.fc} onChange={handleChange} className="border p-2 rounded" required />

                    <input type="number" name="fr" placeholder="FR (rpm)" value={form.fr} onChange={handleChange} className="border p-2 rounded" required />

                    <input type="number" step="0.1" name="tc" placeholder="TC (°C)" value={form.tc} onChange={handleChange} className="border p-2 rounded" required />

                    <input type="number" name="oxm" placeholder="OXM (%)" value={form.oxm} onChange={handleChange} className="border p-2 rounded" required />

                    <textarea name="descripcion" placeholder="Descripción *" value={form.descripcion} onChange={handleChange} className="border p-2 rounded col-span-1 md:col-span-2" required />

                    <button type="submit" className="col-span-1 md:col-span-2 bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
                        Guardar Nota
                    </button>
                </form>
            </div>

            {/* Lista de Notas */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Notas de Evolución</h2>
                {notas.length === 0 ? (
                    <p className="text-gray-500">No hay notas registradas.</p>
                ) : (
                    <div className="space-y-4">
                        {notas.map((nota) => (
                            <div key={nota.id} className="bg-white p-4 rounded-lg shadow border">
                                <p className="text-sm text-gray-500">
                                    Fecha: <span className="font-medium">{nota.fecha_elaboracion}</span> | Hora:{' '}
                                    <span className="font-medium">{nota.hora}</span> | Sexo: {nota.sexo}
                                </p>
                                <p className="text-sm">
                                    TA: {nota.ta} | FC: {nota.fc} | FR: {nota.fr} | TC: {nota.tc} | OXM: {nota.oxm}%
                                </p>
                                <p className="mt-2 text-gray-700">{nota.descripcion}</p>

                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={() => handleEdit(nota)}
                                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(nota.id)}
                                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                    >
                                        Eliminar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const logo = await getLogoBase64("/LOGO_UPS.png"); // coloca tu logo en public/logo.png
                                            generarPDFNotaProfesional(
                                                nota,
                                                { nombre: "Dr. Horencio De Jesús Ruiz Ruedas", cedula: "14811916" },
                                                paciente!, // o datos dinámicos
                                                logo
                                            );
                                        }}
                                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                        Abrir PDF
                                    </button>


                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Edición */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl shadow-lg">
                        <h2 className="text-xl font-semibold mb-4">Editar Nota</h2>
                        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select name="sexo" value={editForm.sexo} onChange={handleEditChange} className="border p-2 rounded" required>
                                <option value="">Sexo *</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                            </select>

                            <input type="date" name="fecha_elaboracion" value={editForm.fecha_elaboracion} onChange={handleEditChange} className="border p-2 rounded" required />

                            <input type="time" name="hora" value={editForm.hora} onChange={handleEditChange} className="border p-2 rounded" required />

                            <input type="text" name="ta" placeholder="TA (Ej. 120/80)" value={editForm.ta} onChange={handleEditChange} className="border p-2 rounded" required />

                            <input type="number" name="fc" placeholder="FC (lpm)" value={editForm.fc} onChange={handleEditChange} className="border p-2 rounded" required />

                            <input type="number" name="fr" placeholder="FR (rpm)" value={editForm.fr} onChange={handleEditChange} className="border p-2 rounded" required />

                            <input type="number" step="0.1" name="tc" placeholder="TC (°C)" value={editForm.tc} onChange={handleEditChange} className="border p-2 rounded" required />

                            <input type="number" name="oxm" placeholder="OXM (%)" value={editForm.oxm} onChange={handleEditChange} className="border p-2 rounded" required />

                            <textarea name="descripcion" placeholder="Descripción *" value={editForm.descripcion} onChange={handleEditChange} className="border p-2 rounded col-span-1 md:col-span-2" required />

                            <div className="col-span-1 md:col-span-2 flex justify-between">
                                <button type="button" onClick={() => setModalOpen(false)} className="bg-gray-400 text-white py-2 px-4 rounded hover:bg-gray-500">
                                    Cancelar
                                </button>
                                <button type="submit" className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600">
                                    Actualizar Nota
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PacienteDetalle;
