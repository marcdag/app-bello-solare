import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataHoraBR, enviarArquivo, texto, voltar } from '@/lib/util';
import { Campo, Cartao, Flash, Titulo, Vazio, btn, campo } from '@/components/ui';

async function registrar(f: FormData) {
  'use server';
  await exigir('equipe');
  const sb = await supabaseServidor();
  const bloco = texto(f, 'bloco');
  const numero = texto(f, 'numero');
  const { data: un } = await sb.from('unidades').select('id').eq('bloco_id', bloco).eq('numero', numero).maybeSingle();
  if (!un) {
    const faixa = 'BCDE'.includes(bloco) ? '101–108 a 401–408' : '101–110 a 401–410';
    voltar('/portaria', { erro: `Apto ${numero} não existe no Bloco ${bloco} (${faixa}).` });
  }
  let foto: string | null = null;
  try { foto = await enviarArquivo(sb, f.get('foto'), 'encomendas'); } catch (e: any) { voltar('/portaria', { erro: e.message }); }
  const { data: s } = await sb.auth.getUser();
  const { error } = await sb.from('encomendas').insert({ unidade_id: un!.id, descricao: texto(f, 'descricao') || 'Encomenda', foto_path: foto, registrada_por: s.user?.id });
  if (error) voltar('/portaria', { erro: error.message });
  voltar('/portaria', { msg: `Registrada. Moradores do Bloco ${bloco} · ${numero} foram avisados.` });
}

async function entregar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('entregar_encomenda', { p_id: texto(f, 'id'), p_codigo: texto(f, 'codigo'), p_nome: texto(f, 'nome') });
  if (error) voltar('/portaria', { erro: error.message });
  voltar('/portaria', { msg: 'Entrega registrada.' });
}

export default async function Portaria({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('equipe');
  const sb = await supabaseServidor();
  const { data } = await sb.from('encomendas').select('id, descricao, registrada_em, unidades(bloco_id, numero)').is('retirada_em', null).order('registrada_em');
  const pend = (data ?? []) as any[];
  const antigas = pend.filter((e) => Date.now() - new Date(e.registrada_em).getTime() > 7 * 864e5).length;
  return (
    <>
      <Flash sp={sp} />
      <Titulo>Encomendas</Titulo>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Cartao className="lg:w-[420px] lg:shrink-0">
          <h2 className="mb-3 text-lg font-extrabold">Registrar encomenda</h2>
          <form action={registrar} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Bloco"><select name="bloco" className={campo + ' text-lg font-bold'} required>{'ABCDEFGHIJ'.split('').map((b) => <option key={b}>{b}</option>)}</select></Campo>
              <Campo rotulo="Apartamento"><input name="numero" className={campo + ' text-lg font-bold'} inputMode="numeric" pattern="[1-4][0-9]{2}" required placeholder="204" /></Campo>
            </div>
            <Campo rotulo="Descrição"><input name="descricao" className={campo} placeholder="Ex.: caixa média · Mercado Livre" /></Campo>
            <Campo rotulo="Foto da etiqueta (opcional)"><input type="file" name="foto" accept="image/*" capture="environment" className="text-sm" /></Campo>
            <button className={btn + ' min-h-12 text-base'}>Registrar e avisar morador</button>
          </form>
        </Cartao>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-lg font-extrabold">Aguardando retirada ({pend.length}){antigas ? <span className="ml-2 text-sm font-semibold text-amber-700">{antigas} há mais de 7 dias</span> : null}</h2>
          <p className="text-sm text-cinza-texto">Peça ao morador o código de 4 dígitos que aparece no app dele.</p>
          {pend.length === 0 && <Vazio>Nenhuma encomenda aguardando.</Vazio>}
          {pend.map((e) => (
            <Cartao key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-extrabold">Bloco {e.unidades?.bloco_id} · {e.unidades?.numero}</p><p className="text-sm text-cinza-texto">{e.descricao} · {dataHoraBR(e.registrada_em)}</p></div>
              </div>
              <form action={entregar} className="mt-3 grid grid-cols-[110px_1fr_auto] items-end gap-2">
                <input type="hidden" name="id" value={e.id} />
                <Campo rotulo="Código"><input name="codigo" className={campo + ' tracking-widest'} inputMode="numeric" maxLength={4} minLength={4} required /></Campo>
                <Campo rotulo="Quem retirou"><input name="nome" className={campo} /></Campo>
                <button className={btn}>Entregar</button>
              </form>
            </Cartao>
          ))}
        </div>
      </div>
    </>
  );
}
