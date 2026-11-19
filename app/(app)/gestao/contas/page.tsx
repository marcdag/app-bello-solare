import Link from 'next/link';
import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { mesAno, texto, voltar } from '@/lib/util';
import { Campo, Cartao, Flash, Selo, Titulo, Vazio, btn, campo } from '@/components/ui';

async function criar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const mes = texto(f, 'mes'); // AAAA-MM
  const { data, error } = await sb.from('contas_mensais').insert({ competencia: `${mes}-01` }).select('id').single();
  if (error) voltar('/gestao/contas', { erro: error.code === '23505' ? 'Esse mês já existe.' : error.message });
  voltar(`/gestao/contas/${data!.id}`, { msg: 'Mês criado. Lance receitas e despesas e anexe os documentos.' });
}

export default async function GestaoContas({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const sb = await supabaseServidor();
  const { data } = await sb.from('contas_mensais').select('id, competencia, status').order('competencia', { ascending: false });
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Monte o balancete do mês, publique para os moradores e o Conselho Fiscal registra o parecer.">Prestação de contas</Titulo>
      <Cartao className="mb-4 max-w-lg">
        <form action={criar} className="flex items-end gap-2">
          <div className="flex-1"><Campo rotulo="Novo mês"><input type="month" name="mes" required className={campo} /></Campo></div>
          <button className={btn}>Criar</button>
        </form>
      </Cartao>
      {(data ?? []).length === 0 && <Vazio>Nenhum mês cadastrado.</Vazio>}
      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((c) => (
          <Link key={c.id} href={`/gestao/contas/${c.id}`}>
            <Cartao className="flex items-center justify-between hover:border-royal"><span className="text-lg font-extrabold capitalize">{mesAno(c.competencia)}</span><Selo status={c.status} /></Cartao>
          </Link>
        ))}
      </div>
    </>
  );
}
