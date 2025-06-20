import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  const { paciente_id, monto, semana_id } = await request.json();

  const { data, error } = await supabase
    .from('depositos_semanales')
    .upsert([{ paciente_id, monto, semana_id, fecha: new Date().toISOString() }])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data[0]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paciente_id = searchParams.get('paciente_id');
  const semana_id = searchParams.get('semana_id');

  let query = supabase.from('depositos_semanales').select('*');

  if (paciente_id) query = query.eq('paciente_id', paciente_id);
  if (semana_id) query = query.eq('semana_id', semana_id);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}