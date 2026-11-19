import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { rotuloTipo, texto, voltar } from '@/lib/util';
import { Aviso, Campo, Cartao, Flash, Titulo, btn, btnSec, campo } from '@/components/ui';

const PAPEIS = [
  ['morador', 'Morador'], ['portaria', 'Portaria'], ['subsindico', 'Subsíndico'],
  ['sindico', 'Síndico'], ['conselho', 'Conselho'], ['admin', 'Admin técnico'],
] as const;

async function salvarPapeis(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const novos = PAPEIS.map(([p]) => p).filter((p) => f.get(p) === 'on');
  const { error } = await sb.rpc('definir_papeis', { p: texto(f, 'id'), novos });
  if (error) voltar(`/gestao/pessoas?q=${encodeURIComponent(texto(f, 'q'))}`, { erro: error.message });
  voltar(`/gestao/pessoas?q=${encodeURIComponent(texto(f, 'q'))}`, { msg: 'Papéis atualizados.' });
}

async function subsindico(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.from('blocos').update({ subsindico_id: texto(f, 'perfil') || null }).eq('id', texto(f, 'bloco'));
  if (error) voltar('/gestao/pessoas', { erro: error.message });
  voltar('/gestao/pessoas', { msg: `Subsíndico do Bloco ${texto(f, 'bloco')} atualizado.` });
}

async function encerrar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('encerrar_vinculo', { p_id: texto(f, 'vinculo') });
  if (error) voltar('/gestao/pessoas', { erro: error.message });
  voltar(`/gestao/pessoas?q=${encodeURIComponent(texto(f, 'q'))}`, { msg: 'Acesso à unidade encerrado (mudança). O histórico fica guardado.' });
}

export default async function Pessoas({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const q = (sp.q ?? '').trim();
  const sb = await supabaseServidor();
  let consulta = sb.from('perfis').select('id, nome, telefone, papeis, vinculos!vinculos_perfil_id_fkey(id, status, tipo, unidades(bloco_id, numero))').order('nome').limit(50);
  if (q) consulta = consulta.ilike('nome', `%${q}%`);
  const [{ data: pessoas }, { data: blocos }, { data: equipe }] = await Promise.all([
    consulta,
    sb.from('blocos').select('id, subsindico_id').order('id'),
    sb.from('perfis').select('id, nome').contains('papeis', ['subsindico']).order('nome'),
  ]);
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Defina quem é portaria, síndico, subsíndico e Conselho. Novos moradores recebem o papel automaticamente ao serem aprovados.">Pessoas e papéis</Titulo>
      <form className="mb-4 flex max-w-xl items-end gap-2">
        <div className="flex-1"><Campo rotulo="Buscar por nome"><input name="q" defaultValue={q} className={campo} /></Campo></div>
        <button className={btn}>Buscar</button>
      </form>
      <div className="flex flex-col gap-3">
        {(pessoas ?? []).map((p: any) => (
          <Cartao key={p.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">{p.nome || 'Sem nome'} <span className="font-normal text-cinza-texto">{p.telefone ?? ''}</span></p>
              <p className="text-sm text-cinza-texto">{(p.vinculos ?? []).filter((v: any) => v.status === 'aprovado').map((v: any) => `Bloco ${v.unidades?.bloco_id} · ${v.unidades?.numero} (${rotuloTipo[v.tipo] ?? v.tipo})`).join(', ')}</p>
            </div>
            <form action={salvarPapeis} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="q" value={q} />
              {PAPEIS.map(([k, r]) => (
                <label key={k} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={k} defaultChecked={p.papeis?.includes(k)} className="h-5 w-5 accent-royal" />{r}</label>
              ))}
              <button className={btnSec}>Salvar papéis</button>
            </form>
            {(p.vinculos ?? []).filter((v: any) => v.status === 'aprovado').map((v: any) => (
              <form key={v.id} action={encerrar} className="mt-1"><input type="hidden" name="vinculo" value={v.id} /><input type="hidden" name="q" value={q} />
                <button className="min-h-9 text-xs font-bold text-red-700">Encerrar acesso a Bloco {v.unidades?.bloco_id} · {v.unidades?.numero} (mudou-se)</button></form>
            ))}
          </Cartao>
        ))}
      </div>
      <h2 className="mb-2 mt-6 text-lg font-extrabold">Subsíndicos por bloco</h2>
      {(equipe ?? []).length === 0 && <Aviso>Marque o papel “Subsíndico” em uma pessoa acima para poder escolhê-la aqui.</Aviso>}
      <div className="grid gap-2 md:grid-cols-2">
        {(blocos ?? []).map((b) => (
          <form key={b.id} action={subsindico} className="flex items-center gap-2 rounded-xl border border-cinza-borda bg-white p-2">
            <input type="hidden" name="bloco" value={b.id} /><span className="w-20 font-bold">Bloco {b.id}</span>
            <select name="perfil" defaultValue={b.subsindico_id ?? ''} className={campo}><option value="">—</option>{(equipe ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
            <button className={btnSec}>Salvar</button>
          </form>
        ))}
      </div>
    </>
  );
}
