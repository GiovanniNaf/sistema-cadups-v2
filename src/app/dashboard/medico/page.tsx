'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Paciente {
  id: number;
  nombre: string;
  numero_expediente: string;
  edad: number;
  notas_count: number;
}

const MedicoPage = () => {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchPacientes = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('pacientes')
        .select(`
          id,
          nombre,
          numero_expediente,
          edad,
          nota_evolucion ( id )
        `);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pacientesConNotas = data.map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        numero_expediente: p.numero_expediente,
        edad: p.edad,
        notas_count: p.nota_evolucion ? p.nota_evolucion.length : 0,
      }));

      setPacientes(pacientesConNotas);
      setLoading(false);
    };

    fetchPacientes();
  }, []);

  const filteredPacientes = pacientes.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.numero_expediente.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="p-4">Cargando pacientes...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Área Médica</h1>

      {/* Buscador */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o expediente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPacientes.map((paciente) => (
          <div
            key={paciente.id}
            className="bg-white shadow-md rounded-2xl p-5 border border-gray-200 hover:shadow-lg transition"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {paciente.nombre}
            </h2>
            <p className="text-sm text-gray-600">
              Expediente: <span className="font-medium">{paciente.numero_expediente}</span>
            </p>
            <p className="text-sm text-gray-600">Edad: {paciente.edad}</p>
            <p className="text-sm text-gray-600 mb-4">
              Notas médicas: <span className="font-bold">{paciente.notas_count}</span>
            </p>

            <Link
              href={`/dashboard/medico/${paciente.id}`}
              className="block text-center bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              Ver Detalles
            </Link>
          </div>
        ))}
      </div>

      {filteredPacientes.length === 0 && (
        <p className="text-gray-500 mt-6 text-center">No se encontraron pacientes.</p>
      )}
    </div>
  );
};

export default MedicoPage;
