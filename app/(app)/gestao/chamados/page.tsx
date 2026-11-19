import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, texto, voltar } from '@/lib/util';
import { Flash, Selo, Titulo, Vazio, btn, btnSec, campo } from '@/components/ui';

const STATUS = ['Aberto', 'Em análise', 'Em execução', 'Concluído', 'Recusado'];

async function atualizar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error, count } = await sb.from('chamados')
    .update({ status: texto(f, 'status'), resposta: texto(f, 'resposta') || null }, { count: 'exact' }).eq('id', texto(f, 'id'));
  if (error || count === 0) voltar('/gestao/chamados', { erro: error?.message ?? 'Sem permissão para este chamado.' });
  voltar('/gestao/chamados', { msg: 'Chamado atualizado. Quem abriu foi avisado.' });
}

export default async function GestaoChamados({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await sessao();
  if (!s.gestao && s.blocosSubsindico.length === 0) redirect('/');
  const sb = await supabaseServidor();
  let q = sb.from('chamados').select('*').order('criado_em', { ascending: false }).limit(300);
  if (!s.gestao) q = q.in('bloco_id', s.blocosSubsindico);
  if (sp.todos !== '1') q = q.not('status', 'in', '("Concluído","Recusado")');
  const { data } = await q;
  const lista = data ?? [];
  const dias = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub={s.gestao ? undefined : `Bloco(s) ${s.blocosSubsindico.join(', ')}`}>Chamados de manutenção</Titulo>
      <div className="mb-4 flex gap-2">
        <Link href="/gestao/chamados" className={sp.todos === '1' ? btnSec : btn}>Em aberto</Link>
        <Link href="/gestao/chamados?todos=1" className={sp.todos === '1' ? btn : btnSec}>Todos</Link>
      </div>
      {lista.length === 0 && <Vazio>Nenhum chamado.</Vazio>}
      {lista.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-cinza-borda bg-white">
          <table className="w-full min-w-[860px] border-collapse">
            <thead><tr><th>Chamado</th><th>Local</th><th>Aberto</th><th>Status</th><th>Atualizar</th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><p className="font-bold">{c.titulo}</p><p className="text-xs text-cinza-texto">{c.categoria}{c.descricao ? ` · ${c.descricao}` : ''}</p></td>
                  <td className="text-cinza-texto">{c.local}{c.bloco_id ? ` · Bloco ${c.bloco_id}` : ''}</td>
                  <td className="whitespace-nowrap text-cinza-texto">{dataBR(c.criado_em)} ({dias(c.criado_em)} d)</td>
                  <td><Selo status={c.status} /></td>
                  <td>
                    <form action={atualizar} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="status" defaultValue={c.status} className={campo + ' w-36'}>{STATUS.map((x) => <option key={x}>{x}</option>)}</select>
                      <input name="resposta" defaultValue={c.resposta ?? ''} placeholder="Resposta ao morador" className={campo + ' w-48'} />
                      <button className={btnSec}>Salvar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
