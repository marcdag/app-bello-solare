import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/server';

export async function GET() {
  const sb = await supabaseServidor();
  const [{ data, error }, { data: vagas }] = await Promise.all([sb.rpc('codigos_convite'), sb.from('vagas').select('numero, unidade_id')]);
  if (error) return new NextResponse(error.message, { status: 403 });
  const linhas = ['bloco;apartamento;vagas;codigo_convite'];
  for (const c of data as any[]) {
    const v = (vagas ?? []).filter((x) => x.unidade_id === c.unidade_id).map((x) => x.numero).join(' e ');
    linhas.push([c.bloco, c.numero, v, c.codigo].join(';'));
  }
  return new NextResponse('﻿' + linhas.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="convites-bello-solare.csv"', 'Cache-Control': 'no-store' },
  });
}
