import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { texto, voltar } from '@/lib/util';
import { Campo, Cartao, Flash, Titulo, btn, btnSec, campo } from '@/components/ui';

async function salvar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  for (const chave of ['menor_taxa_condominial', 'maior_taxa_condominial']) {
    const v = texto(f, chave).replace(/\./g, '').replace(',', '.');
    if (v && isNaN(Number(v))) voltar('/gestao/configuracoes', { erro: 'Valor inválido.' });
    if (v) await sb.from('configuracoes').update({ valor: v }).eq('chave', chave);
  }
  voltar('/gestao/configuracoes', { msg: 'Configurações salvas.' });
}

async function enquadramento(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.from('enquadramentos').update({ titulo: texto(f, 'titulo'), base_legal: texto(f, 'base'), multa_direta: f.get('direta') === 'on' }).eq('id', texto(f, 'id'));
  if (error) voltar('/gestao/configuracoes', { erro: error.message });
  voltar('/gestao/configuracoes', { msg: 'Enquadramento atualizado.' });
}

async function espaco(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.from('espacos').update({ horario: texto(f, 'horario'), max_convidados: Number(texto(f, 'max')), taxa: texto(f, 'taxa'), ativo: f.get('ativo') === 'on' }).eq('id', texto(f, 'id'));
  if (error) voltar('/gestao/configuracoes', { erro: error.message });
  voltar('/gestao/configuracoes', { msg: 'Espaço atualizado.' });
}

export default async function Config({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const sb = await supabaseServidor();
  const [{ data: cfg }, { data: enq }, { data: esp }] = await Promise.all([
    sb.from('configuracoes').select('*'), sb.from('enquadramentos').select('*').order('titulo'), sb.from('espacos').select('*').order('nome'),
  ]);
  const v = (k: string) => cfg?.find((c) => c.chave === k)?.valor ?? '';
  return (
    <>
      <Flash sp={sp} />
      <Titulo>Configurações</Titulo>
      <Cartao className="mb-4 max-w-2xl">
        <h2 className="mb-3 text-lg font-extrabold">Taxas condominiais vigentes</h2>
        <form action={salvar} className="grid gap-3 md:grid-cols-2">
          <Campo rotulo="Menor taxa (R$)" dica="Base das multas do RI Art. 82"><input name="menor_taxa_condominial" defaultValue={v('menor_taxa_condominial')} inputMode="decimal" className={campo} /></Campo>
          <Campo rotulo="Maior taxa (R$)" dica="Base de penalidades de espaços (RI Art. 21)"><input name="maior_taxa_condominial" defaultValue={v('maior_taxa_condominial')} inputMode="decimal" className={campo} /></Campo>
          <button className={btn + ' justify-self-start'}>Salvar</button>
        </form>
      </Cartao>
      <h2 className="mb-2 text-lg font-extrabold">Enquadramentos (Convenção e Regimento)</h2>
      <div className="mb-6 flex flex-col gap-2">
        {(enq ?? []).map((e) => (
          <form key={e.id} action={enquadramento} className="grid items-end gap-2 rounded-xl border border-cinza-borda bg-white p-3 md:grid-cols-[2fr_1.4fr_auto_auto]">
            <input type="hidden" name="id" value={e.id} />
            <Campo rotulo="Infração"><input name="titulo" defaultValue={e.titulo} className={campo} /></Campo>
            <Campo rotulo="Base legal"><input name="base" defaultValue={e.base_legal} className={campo} /></Campo>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="direta" defaultChecked={e.multa_direta} className="h-5 w-5 accent-royal" />Multa direta</label>
            <button className={btnSec}>Salvar</button>
          </form>
        ))}
      </div>
      <h2 className="mb-2 text-lg font-extrabold">Espaços para reserva</h2>
      <div className="flex flex-col gap-2">
        {(esp ?? []).map((e) => (
          <form key={e.id} action={espaco} className="grid items-end gap-2 rounded-xl border border-cinza-borda bg-white p-3 md:grid-cols-[1fr_2fr_100px_1.4fr_auto_auto]">
            <input type="hidden" name="id" value={e.id} /><p className="self-center font-bold">{e.nome}</p>
            <Campo rotulo="Horário"><input name="horario" defaultValue={e.horario} className={campo} /></Campo>
            <Campo rotulo="Convidados"><input name="max" type="number" defaultValue={e.max_convidados} className={campo} /></Campo>
            <Campo rotulo="Taxa"><input name="taxa" defaultValue={e.taxa} className={campo} /></Campo>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={e.ativo} className="h-5 w-5 accent-royal" />Ativo</label>
            <button className={btnSec}>Salvar</button>
          </form>
        ))}
      </div>
    </>
  );
}
