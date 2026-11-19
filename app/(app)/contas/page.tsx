import Link from 'next/link';
import { supabaseServidor } from '@/lib/supabase/server';
import { mesAno } from '@/lib/util';
import { Cartao, Selo, Titulo, Vazio } from '@/components/ui';

export default async function Contas() {
  const sb = await supabaseServidor();
  const { data } = await sb.from('contas_mensais').select('id, competencia, status, publicada_em').neq('status', 'rascunho').order('competencia', { ascending: false });
  return (
    <>
      <Titulo sub="Balancetes mensais publicados pela administração, com parecer do Conselho Fiscal.">Prestação de contas</Titulo>
      {(data ?? []).length === 0 && <Vazio>Nenhuma prestação de contas publicada ainda.</Vazio>}
      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((c) => (
          <Link key={c.id} href={`/contas/${c.id}`}>
            <Cartao className="flex items-center justify-between gap-3 hover:border-royal">
              <span className="text-lg font-extrabold capitalize">{mesAno(c.competencia)}</span>
              <Selo status={c.status} />
            </Cartao>
          </Link>
        ))}
      </div>
    </>
  );
}
