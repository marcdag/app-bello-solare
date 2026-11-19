import { exigir, sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, hojeISO, texto, voltar } from '@/lib/util';
import { Campo, Cartao, Flash, Selo, Titulo, Vazio, btn, btnSec, campo } from '@/components/ui';

async function reservar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('solicitar_reserva', {
    p_espaco: texto(f, 'espaco'), p_unidade: texto(f, 'unidade'), p_data: texto(f, 'data'), p_convidados: Number(texto(f, 'convidados') || 0),
  });
  if (error) voltar('/reservas', { erro: error.message });
  voltar('/reservas', { msg: 'Reserva solicitada. Entregue a lista de convidados com RG na portaria.' });
}

async function cancelar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('cancelar_reserva', { p_id: texto(f, 'id') });
  if (error) voltar('/reservas', { erro: error.message });
  voltar('/reservas', { msg: 'Reserva cancelada.' });
}

export default async function Reservas({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('membro');
  const s = await sessao();
  const sb = await supabaseServidor();
  const [{ data: espacos }, { data: reservas }] = await Promise.all([
    sb.from('espacos').select('*').eq('ativo', true).order('nome'),
    sb.from('reservas').select('*, espacos(nome)').neq('status', 'cancelada').gte('data', hojeISO()).order('data').limit(200),
  ]);
  const minhasIds = s.unidades.map((u) => u.unidade_id);
  const minhas = (reservas ?? []).filter((r) => minhasIds.includes(r.unidade_id));
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Só para unidade em dia. Reserve com 1 dia de antecedência; cancelamento sem custo até 10 dias antes (Regimento Interno).">Reservar espaço</Titulo>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Cartao className="lg:w-[420px] lg:shrink-0">
          <form action={reservar} className="flex flex-col gap-3">
            <Campo rotulo="Espaço">
              <select name="espaco" className={campo} required>{(espacos ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome} — até {e.max_convidados} convidados</option>)}</select>
            </Campo>
            <Campo rotulo="Data"><input type="date" name="data" className={campo} min={hojeISO()} required /></Campo>
            <Campo rotulo="Número de convidados"><input type="number" name="convidados" min={0} className={campo} required /></Campo>
            {s.unidades.length > 1
              ? <Campo rotulo="Unidade"><select name="unidade" className={campo}>{s.unidades.map((u) => <option key={u.unidade_id} value={u.unidade_id}>{u.rotulo}</option>)}</select></Campo>
              : <input type="hidden" name="unidade" value={s.unidades[0]?.unidade_id} />}
            <button className={btn}>Solicitar reserva</button>
          </form>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {(espacos ?? []).map((e) => <p key={e.id}><strong>{e.nome}:</strong> {e.horario}. Taxa: {e.taxa}.</p>)}
            <p className="text-cinza-texto">Natal e Ano Novo são reservados por sorteio (RI Art. 25).</p>
          </div>
        </Cartao>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-lg font-extrabold">Minhas reservas</h2>
          {minhas.length === 0 && <Vazio>Nenhuma reserva futura.</Vazio>}
          {minhas.map((r: any) => (
            <Cartao key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-bold">{r.espacos?.nome} · {dataBR(r.data)}</p><p className="text-sm text-cinza-texto">{r.convidados} convidados</p></div>
              <div className="flex items-center gap-2"><Selo status={r.status} />
                <form action={cancelar}><input type="hidden" name="id" value={r.id} /><button className={btnSec}>Cancelar</button></form></div>
            </Cartao>
          ))}
          <h2 className="mt-3 text-lg font-extrabold">Datas já ocupadas</h2>
          {(reservas ?? []).length === 0 && <Vazio>Todas as datas livres.</Vazio>}
          <div className="flex flex-wrap gap-2">
            {(reservas ?? []).map((r: any) => <span key={r.id} className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-cinza-borda">{dataBR(r.data)} · {r.espacos?.nome}</span>)}
          </div>
        </div>
      </div>
    </>
  );
}
