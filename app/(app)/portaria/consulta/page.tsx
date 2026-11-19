import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { Campo, Titulo, Vazio, btn, campo } from '@/components/ui';

export default async function Consulta({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { q = '' } = await searchParams;
  await exigir('equipe');
  const sb = await supabaseServidor();
  const { data, error } = q ? await sb.rpc('consulta_portaria', { q }) : { data: [], error: null };
  return (
    <>
      <Titulo sub="A portaria vê só nome, unidade, placa e vaga. Telefone e documentos ficam ocultos (LGPD).">Consultar placa ou unidade</Titulo>
      <form className="mb-4 flex max-w-xl items-end gap-2">
        <div className="flex-1"><Campo rotulo="Placa, bloco ou apto"><input name="q" defaultValue={q} className={campo} placeholder="Ex.: RTA2B19 ou C204" autoFocus /></Campo></div>
        <button className={btn}>Buscar</button>
      </form>
      {error && <Vazio>{error.message}</Vazio>}
      {q && !error && (data ?? []).length === 0 && <Vazio>Nada encontrado. Só aparecem veículos já validados pelo síndico.</Vazio>}
      {(data ?? []).length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-cinza-borda bg-white">
          <table className="w-full min-w-[640px] border-collapse">
            <thead><tr><th>Placa</th><th>Unidade</th><th>Veículo</th><th>Vaga</th><th>Adesivo</th><th>Responsável</th></tr></thead>
            <tbody>
              {(data as any[]).map((r) => (
                <tr key={r.placa}><td className="font-extrabold tracking-wide">{r.placa}</td><td className="font-bold text-royal">{r.unidade}</td>
                  <td>{r.modelo}{r.cor ? ` ${r.cor}` : ''}</td><td>{r.vaga ?? '—'}</td><td>{r.adesivo ?? '—'}</td><td>{r.responsavel ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
