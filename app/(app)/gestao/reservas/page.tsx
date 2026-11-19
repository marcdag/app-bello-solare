import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, hojeISO, texto, voltar } from '@/lib/util';
import { Flash, Selo, Titulo, Vazio, btn, btnSec } from '@/components/ui';

async function mudar(f: FormData, st: 'confirmada' | 'cancelada') {
  const sb = await supabaseServidor();
  const { error } = st === 'cancelada'
    ? await sb.rpc('cancelar_reserva', { p_id: texto(f, 'id') })
    : await sb.from('reservas').update({ status: st }).eq('id', texto(f, 'id'));
  if (error) voltar('/gestao/reservas', { erro: error.message });
  voltar('/gestao/reservas', { msg: 'Reserva atualizada.' });
}
async function confirmar(f: FormData) { 'use server'; await mudar(f, 'confirmada'); }
async function cancelar(f: FormData) { 'use server'; await mudar(f, 'cancelada'); }

export default async function GestaoReservas({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const sb = await supabaseServidor();
  const { data } = await sb.from('reservas').select('*, espacos(nome), unidades(bloco_id, numero)').neq('status', 'cancelada').gte('data', hojeISO()).order('data');
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Confirme depois de conferir adimplência e taxa de uso. Faça o checklist de entrada e saída com o morador.">Reservas</Titulo>
      {(data ?? []).length === 0 && <Vazio>Nenhuma reserva futura.</Vazio>}
      {(data ?? []).length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-cinza-borda bg-white">
          <table className="w-full min-w-[720px] border-collapse">
            <thead><tr><th>Data</th><th>Espaço</th><th>Unidade</th><th>Convidados</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data as any[]).map((r) => (
                <tr key={r.id}>
                  <td className="font-bold">{dataBR(r.data)}</td><td>{r.espacos?.nome}</td><td>Bloco {r.unidades?.bloco_id} · {r.unidades?.numero}</td><td>{r.convidados}</td>
                  <td><Selo status={r.status} /></td>
                  <td><form action={cancelar} className="flex gap-2"><input type="hidden" name="id" value={r.id} />
                    {r.status === 'solicitada' && <button formAction={confirmar} className={btn}>Confirmar</button>}
                    <button formAction={cancelar} className={btnSec}>Cancelar</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
