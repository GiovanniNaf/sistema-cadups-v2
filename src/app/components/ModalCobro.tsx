import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ModalCobroProps {
  pacienteId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ModalCobro({ pacienteId, onClose, onSuccess }: ModalCobroProps) {
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState('tienda');
  const [observacion, setObservacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const registrarCobro = async () => {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await supabase.from('deudas').insert([
      {
        paciente_id: pacienteId,
        monto: montoNum,
        tipo,
        pagado:false,
        fecha: new Date(),
      },
    ]);

    setLoading(false);

    if (error) {
      setError('Error al registrar el cobro.');
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-md w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold mb-4">Registrar Cobro</h2>

        <label className="block mb-2 font-medium">Monto</label>
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
        />

        <label className="block mb-2 font-medium">Tipo de cobro</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
        >
          <option value="tienda">Tienda</option>
          <option value="medicamentos">Medicamentos</option>
          <option value="mensualidad">Mensualidad</option>
        </select>

        <label className="block mb-2 font-medium">Observaciones</label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
        />

        {error && <p className="text-red-600 mb-2">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancelar
          </button>
          <button
            onClick={registrarCobro}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
