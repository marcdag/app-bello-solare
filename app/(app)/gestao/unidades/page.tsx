import Link from 'next/link';
import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { texto, voltar } from '@/lib/util';
import { Aviso, Flash, Titulo, btn, btnSec } from '@/components/ui';

async function novoCodigo(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('novo_codigo_convite', { u: texto(f, 'id') });
  if (error) voltar('/gestao/unidades', { erro: error.message });
  voltar(`/gestao/unidades?bloco=${texto(f, 'bloco')}`, { msg: 'Novo código gerado. O anterior deixou de valer.' });
}

export default async function Unidades({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const bloco = sp.bloco && /^[A-J]$/.test(sp.bloco) ? sp.bloco : 'A';
  const sb = await supabaseServidor();
  const [{ data: codigos }, { data: vagas }, { data: vinc }] = await Promise.all([
    sb.rpc('codigos_convite'),
    sb.from('vagas').select('numero, unidade_id'),
    sb.from('vinculos').select('unidade_id, tipo, perfis!vinculos_perfil_id_fkey(nome)').eq('status', 'aprovado'),
  ]);
  const doBloco = (codigos ?? []).filter((c: any) => c.bloco === bloco);
  const vagasDe = (u: string) => (vagas ?? []).filter((v) => v.unidade_id === u).map((v) => v.numero).join(' e ');
  const pessoasDe = (u: string) => (vinc ?? []).filter((v) => v.unidade_id === u).map((v: any) => v.perfis?.nome).filter(Boolean).join(', ');
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="368 unidades e 406 vagas carregadas da Convenção (Art. 2º e 6.1).">Unidades e convites</Titulo>
      <Aviso>Entregue a cada unidade o seu código de convite (bilhete impresso, por exemplo). Com ele o morador cria a conta e pede o vínculo; você aprova em Cadastros. <Link href="/gestao/unidades/convites.csv" className="font-bold underline">Baixar todos os códigos (CSV)</Link> · <Link href="/gestao/unidades/imprimir" className="font-bold underline">Imprimir bilhetes</Link></Aviso>
      <div className="my-4 flex flex-wrap gap-1.5">
        {'ABCDEFGHIJ'.split('').map((b) => <Link key={b} href={`/gestao/unidades?bloco=${b}`} className={(b === bloco ? btn : btnSec) + ' w-11 px-0'}>{b}</Link>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-cinza-borda bg-white">
        <table className="w-full min-w-[720px] border-collapse">
          <thead><tr><th>Unidade</th><th>Vaga(s)</th><th>Com acesso ao app</th><th>Código de convite</th><th></th></tr></thead>
          <tbody>
            {doBloco.map((c: any) => (
              <tr key={c.unidade_id}>
                <td className="font-bold">Bloco {c.bloco} · {c.numero}</td><td>{vagasDe(c.unidade_id)}</td>
                <td className="text-cinza-texto">{pessoasDe(c.unidade_id) || '—'}</td>
                <td className="font-mono text-base font-bold tracking-widest">{c.codigo}</td>
                <td><form action={novoCodigo}><input type="hidden" name="id" value={c.unidade_id} /><input type="hidden" name="bloco" value={bloco} /><button className="min-h-9 text-xs font-bold text-royal">Gerar novo</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
