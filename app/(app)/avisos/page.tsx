import Link from 'next/link';
import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataHoraBR, voltar } from '@/lib/util';
import { Cartao, Titulo, Vazio, btnSec } from '@/components/ui';

async function marcarTodos() {
  'use server';
  const s = await sessao();
  const sb = await supabaseServidor();
  await sb.from('avisos').update({ lido: true }).eq('perfil_id', s.userId).eq('lido', false);
  voltar('/avisos', { msg: 'Avisos marcados como lidos.' });
}

export default async function Avisos() {
  const s = await sessao();
  const sb = await supabaseServidor();
  const { data } = await sb.from('avisos').select('*').eq('perfil_id', s.userId).order('criado_em', { ascending: false }).limit(100);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Titulo>Avisos</Titulo>
        {s.avisosNaoLidos > 0 && <form action={marcarTodos}><button className={btnSec}>Marcar todos como lidos</button></form>}
      </div>
      {(data ?? []).length === 0 && <Vazio>Nenhum aviso por enquanto.</Vazio>}
      <div className="flex flex-col gap-2">
        {(data ?? []).map((a) => (
          <Link key={a.id} href={a.link ?? '/'}>
            <Cartao className={`flex flex-col gap-0.5 hover:border-royal ${a.lido ? '' : 'border-l-4 border-l-sol'}`}>
              <span className="font-bold">{a.titulo}</span>
              {a.corpo && <span className="text-sm">{a.corpo}</span>}
              <span className="text-xs text-cinza-texto">{dataHoraBR(a.criado_em)}</span>
            </Cartao>
          </Link>
        ))}
      </div>
    </>
  );
}
