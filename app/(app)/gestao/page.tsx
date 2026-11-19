import Link from 'next/link';
import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, rotuloStatus } from '@/lib/util';
import { Aviso, Flash, Kpi, Selo, Titulo } from '@/components/ui';

export default async function Painel({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const sb = await supabaseServidor();
  const c = (q: any) => q.then((r: any) => r.count ?? 0);
  const [oc, ch, vin, pes, vei, pet, enc, rec, unidadesComMorador, recentes, taxa] = await Promise.all([
    c(sb.from('ocorrencias').select('id', { count: 'exact', head: true }).eq('status', 'em_analise')),
    c(sb.from('chamados').select('id', { count: 'exact', head: true }).not('status', 'in', '("Concluído","Recusado")')),
    c(sb.from('vinculos').select('id', { count: 'exact', head: true }).eq('status', 'pendente')),
    c(sb.from('pessoas').select('id', { count: 'exact', head: true }).eq('status', 'pendente')),
    c(sb.from('veiculos').select('id', { count: 'exact', head: true }).eq('status', 'pendente')),
    c(sb.from('pets').select('id', { count: 'exact', head: true }).eq('status', 'pendente')),
    c(sb.from('encomendas').select('id', { count: 'exact', head: true }).is('retirada_em', null)),
    c(sb.from('ocorrencias').select('id', { count: 'exact', head: true }).eq('status', 'em_recurso')),
    sb.from('vinculos').select('unidade_id').eq('status', 'aprovado').then((r) => new Set((r.data ?? []).map((v) => v.unidade_id)).size),
    sb.from('ocorrencias').select('id, fato, status, criada_em, unidades(bloco_id, numero)').order('criada_em', { ascending: false }).limit(6),
    sb.from('configuracoes').select('valor').eq('chave', 'menor_taxa_condominial').single(),
  ]);
  const pct = Math.round((unidadesComMorador / 368) * 100);
  return (
    <>
      <Flash sp={sp} />
      <Titulo>Painel</Titulo>
      {Number(taxa.data?.valor ?? 0) === 0 && (
        <div className="mb-4"><Aviso tipo="alerta">Informe o valor da menor taxa condominial em <Link className="font-bold underline" href="/gestao/configuracoes">Configurações</Link>: ele é a base das multas (RI Art. 82).</Aviso></div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Kpi valor={oc} rotulo="Ocorrências a decidir" cor="text-amber-700" href="/gestao/ocorrencias" />
        <Kpi valor={ch} rotulo="Chamados em aberto" href="/gestao/chamados" />
        <Kpi valor={vin + pes + vei + pet} rotulo="Cadastros a validar" href="/gestao/cadastros" />
        <Kpi valor={enc} rotulo="Encomendas na portaria" href="/portaria" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-x-auto rounded-2xl border border-cinza-borda bg-white">
          <div className="px-4 pb-2 pt-4 text-lg font-extrabold">Ocorrências recentes</div>
          <table className="w-full min-w-[520px] border-collapse">
            <thead><tr><th>Unidade</th><th>Fato</th><th>Data</th><th>Status</th></tr></thead>
            <tbody>
              {(recentes.data ?? []).map((o: any) => (
                <tr key={o.id}><td className="whitespace-nowrap font-bold"><Link href={`/gestao/ocorrencias?id=${o.id}`}>Bloco {o.unidades?.bloco_id} · {o.unidades?.numero}</Link></td>
                  <td>{o.fato}</td><td className="whitespace-nowrap text-cinza-texto">{dataBR(o.criada_em)}</td><td><Selo status={o.status} texto={rotuloStatus[o.status]} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-cinza-borda bg-white p-5">
            <div className="flex justify-between text-sm font-bold"><span>Unidades com morador no app</span><span>{unidadesComMorador} de 368</span></div>
            <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-royal" style={{ width: `${pct}%` }} /></div>
            <Link href="/gestao/unidades" className="text-sm font-bold text-royal">Ver códigos de convite</Link>
          </div>
          {rec > 0 && <Aviso tipo="alerta">{rec} recurso(s) aguardando julgamento do Conselho.</Aviso>}
        </div>
      </div>
    </>
  );
}
