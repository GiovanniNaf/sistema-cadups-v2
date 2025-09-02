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