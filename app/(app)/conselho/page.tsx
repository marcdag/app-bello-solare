import Link from 'next/link';
import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, mesAno, texto, voltar } from '@/lib/util';
import { Campo, Cartao, Flash, Selo, Titulo, Vazio, btn, btnSec, campo } from '@/components/ui';

async function julgar(f: FormData, manter: boolean) {
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('julgar_recurso', { p_id: texto(f, 'id'), p_manter: manter, p_texto: texto(f, 'texto') });
  if (error) voltar('/conselho', { erro: error.message });
  voltar('/conselho', { msg: 'Julgamento registrado. A unidade foi avisada.' });
}
async function manter(f: FormData) { 'use server'; await julgar(f, true); }
async function cancelar(f: FormData) { 'use server'; await julgar(f, false); }

export default async function Conselho({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('conselho');
  const sb = await supabaseServidor();
  const [{ data: rec }, { data: contas }] = await Promise.all([
    sb.from('ocorrencias').select('*, unidades(bloco_id, numero), enquadramentos(titulo, base_legal)').eq('status', 'em_recurso').order('recurso_em'),
    sb.from('contas_mensais').select('id, competencia, status').eq('status', 'publicada').order('competencia'),
  ]);
  const prazo = (d: string) => new Date(new Date(d).getTime() + 10 * 864e5).toLocaleDateString('pt-BR');
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Recursos contra penalidades (julgar em até 10 dias, RI Art. 82 §5º) e contas aguardando parecer.">Conselho Consultivo/Fiscal</Titulo>
      <h2 className="mb-2 text-lg font-extrabold">Recursos para julgar</h2>
      {(rec ?? []).length === 0 && <Vazio>Nenhum recurso pendente.</Vazio>}
      <div className="flex flex-col gap-3">
        {(rec ?? []).map((o: any) => (
          <Cartao key={o.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-extrabold">Bloco {o.unidades?.bloco_id} · {o.unidades?.numero} — {o.penalidade === 'multa' ? `multa de ${Number(o.multa_percentual)}%` : 'notificação'}</p>
              <span className="text-sm font-bold text-amber-700">Julgar até {prazo(o.recurso_em)}</span>
            </div>
            <p className="mt-2 text-sm"><strong>Fato:</strong> {o.fato} ({dataBR(o.data_fato)})</p>
            <p className="text-sm text-cinza-texto">{o.enquadramentos?.titulo} — {o.enquadramentos?.base_legal}</p>
            <p className="mt-2 rounded-lg bg-cinza-fundo px-3 py-2 text-sm"><strong>Defesa da unidade:</strong> {o.recurso_texto}</p>
            <form action={manter} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={o.id} />
              <Campo rotulo="Fundamentação do Conselho"><textarea name="texto" rows={2} className={campo + ' py-2'} required /></Campo>
              <div className="flex flex-wrap gap-2">
                <button formAction={manter} className={btn}>Manter penalidade</button>
                <button formAction={cancelar} className={btnSec}>Cancelar penalidade</button>
              </div>
            </form>
          </Cartao>
        ))}
      </div>
      <h2 className="mb-2 mt-6 text-lg font-extrabold">Contas aguardando parecer</h2>
      {(contas ?? []).length === 0 && <Vazio>Nenhuma.</Vazio>}
      <div className="grid gap-3 md:grid-cols-2">
        {(contas ?? []).map((c) => (
          <Link key={c.id} href={`/contas/${c.id}`}><Cartao className="flex items-center justify-between hover:border-royal"><span className="font-extrabold capitalize">{mesAno(c.competencia)}</span><Selo status={c.status} /></Cartao></Link>
        ))}
      </div>
    </>
  );
}
