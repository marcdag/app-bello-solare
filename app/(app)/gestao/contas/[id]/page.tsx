import { notFound } from 'next/navigation';
import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { enviarArquivo, mesAno, moeda, texto, voltar } from '@/lib/util';
import { ResumoContas } from '@/components/Contas';
import { Campo, Cartao, Flash, Selo, btn, btnSec, campo } from '@/components/ui';

const DESPESAS = ['Portaria e segurança', 'Limpeza e conservação', 'Energia das áreas comuns', 'Água e esgoto das áreas comuns', 'Manutenção e reparos', 'Administradora', 'Seguro predial', 'Jardinagem', 'Material de consumo', 'Tarifas bancárias', 'Outros'];
const RECEITAS = ['Taxas condominiais', 'Taxas de uso de espaços', 'Multas (para o fundo de reserva)', 'Rendimentos de aplicação', 'Outras receitas'];

const ir = (id: string, o: { msg?: string; erro?: string }) => voltar(`/gestao/contas/${id}`, o);

async function lancar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const id = texto(f, 'conta');
  const valor = Number(texto(f, 'valor').replace(/\./g, '').replace(',', '.'));
  if (!(valor >= 0)) ir(id, { erro: 'Valor inválido.' });
  const { error } = await sb.from('contas_lancamentos').insert({ conta_id: id, tipo: texto(f, 'tipo'), categoria: texto(f, 'categoria'), valor });
  if (error) ir(id, { erro: error.message });
  ir(id, { msg: 'Lançamento incluído.' });
}

async function excluirLanc(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  await sb.from('contas_lancamentos').delete().eq('id', texto(f, 'id'));
  ir(texto(f, 'conta'), { msg: 'Lançamento excluído.' });
}

async function dados(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const id = texto(f, 'conta');
  const num = (k: string) => (texto(f, k) ? Number(texto(f, k).replace(/\./g, '').replace(',', '.')) : null);
  const { error } = await sb.from('contas_mensais').update({ fundo_reserva: num('fundo'), inadimplencia_pct: num('inad'), observacoes: texto(f, 'obs') || null }).eq('id', id);
  if (error) ir(id, { erro: error.message });
  ir(id, { msg: 'Dados salvos.' });
}

async function anexar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const id = texto(f, 'conta');
  let path: string | null = null;
  try { path = await enviarArquivo(sb, f.get('arquivo'), `contas/${id}`); } catch (e: any) { ir(id, { erro: e.message }); }
  if (!path) ir(id, { erro: 'Escolha um arquivo.' });
  const { error } = await sb.from('contas_documentos').insert({ conta_id: id, titulo: texto(f, 'titulo'), arquivo_path: path });
  if (error) ir(id, { erro: error.message });
  ir(id, { msg: 'Documento anexado.' });
}

async function publicar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const id = texto(f, 'conta');
  const { error } = await sb.from('contas_mensais').update({ status: 'publicada' }).eq('id', id).eq('status', 'rascunho');
  if (error) ir(id, { erro: error.message });
  ir(id, { msg: 'Publicada. Moradores e Conselho Fiscal foram avisados.' });
}

async function responder(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.from('contas_duvidas').update({ resposta: texto(f, 'resposta'), respondida_em: new Date().toISOString() }).eq('id', texto(f, 'id'));
  if (error) ir(texto(f, 'conta'), { erro: error.message });
  ir(texto(f, 'conta'), { msg: 'Resposta publicada.' });
}

export default async function EditarConta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  await exigir('gestao');
  const sb = await supabaseServidor();
  const [{ data: c }, { data: lanc }, { data: docs }, { data: duv }] = await Promise.all([
    sb.from('contas_mensais').select('*').eq('id', id).single(),
    sb.from('contas_lancamentos').select('*').eq('conta_id', id).order('tipo').order('valor', { ascending: false }),
    sb.from('contas_documentos').select('*').eq('conta_id', id),
    sb.from('contas_duvidas').select('*').eq('conta_id', id).order('criada_em'),
  ]);
  if (!c) notFound();
  const H = ({ n }: { n: string }) => <input type="hidden" name="conta" value={n} />;
  return (
    <>
      <Flash sp={sp} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold capitalize md:text-[28px]">Contas de {mesAno(c.competencia)}</h1><Selo status={c.status} />
        {c.status === 'rascunho' && <form action={publicar} className="ml-auto"><H n={id} /><button className={btn}>Publicar para os moradores</button></form>}
        {c.status !== 'rascunho' && <a href={`/contas/${id}`} className={btnSec + ' ml-auto'}>Ver como morador</a>}
      </div>
      <ResumoContas conta={c} lancamentos={(lanc ?? []) as any} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 text-lg font-extrabold">Lançamentos</h2>
          <form action={lancar} className="grid grid-cols-2 gap-2">
            <H n={id} />
            <Campo rotulo="Tipo"><select name="tipo" className={campo}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></Campo>
            <Campo rotulo="Valor (R$)"><input name="valor" required inputMode="decimal" className={campo} placeholder="48.200,00" /></Campo>
            <div className="col-span-2"><Campo rotulo="Categoria"><input name="categoria" list="categorias" required className={campo} /></Campo></div>
            <datalist id="categorias">{[...DESPESAS, ...RECEITAS].map((x) => <option key={x} value={x} />)}</datalist>
            <button className={btn + ' col-span-2 justify-self-start'}>Incluir</button>
          </form>
          <div className="mt-4 flex flex-col divide-y divide-slate-100">
            {(lanc ?? []).map((l) => (
              <form key={l.id} action={excluirLanc} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <H n={id} /><input type="hidden" name="id" value={l.id} />
                <span>{l.tipo === 'receita' ? '＋' : '－'} {l.categoria}</span>
                <span className="flex items-center gap-2 font-bold">{moeda(l.valor)}<button className="min-h-9 px-2 text-xs font-bold text-red-700">Excluir</button></span>
              </form>
            ))}
          </div>
        </Cartao>
        <div className="flex flex-col gap-4">
          <Cartao>
            <h2 className="mb-3 text-lg font-extrabold">Indicadores do mês</h2>
            <form action={dados} className="grid grid-cols-2 gap-2">
              <H n={id} />
              <Campo rotulo="Saldo do fundo de reserva (R$)"><input name="fundo" defaultValue={c.fundo_reserva ?? ''} inputMode="decimal" className={campo} /></Campo>
              <Campo rotulo="Inadimplência (%)"><input name="inad" defaultValue={c.inadimplencia_pct ?? ''} inputMode="decimal" className={campo} /></Campo>
              <div className="col-span-2"><Campo rotulo="Observações para os moradores"><textarea name="obs" defaultValue={c.observacoes ?? ''} rows={2} className={campo + ' py-2'} /></Campo></div>
              <button className={btnSec + ' col-span-2 justify-self-start'}>Salvar</button>
            </form>
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-lg font-extrabold">Documentos</h2>
            {(docs ?? []).map((d) => <p key={d.id} className="text-sm">• {d.titulo}</p>)}
            <form action={anexar} className="mt-3 flex flex-col gap-2">
              <H n={id} />
              <Campo rotulo="Título"><input name="titulo" required className={campo} list="docs" placeholder="Balancete mensal (PDF)" /></Campo>
              <datalist id="docs"><option value="Balancete mensal (PDF)" /><option value="Extrato bancário (PDF)" /><option value="Notas fiscais e comprovantes" /><option value="Parecer do Conselho Fiscal (PDF)" /></datalist>
              <input type="file" name="arquivo" accept="application/pdf,image/*" required className="text-sm" />
              <button className={btnSec + ' self-start'}>Anexar</button>
            </form>
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-lg font-extrabold">Dúvidas dos moradores ({(duv ?? []).filter((d) => !d.resposta).length} sem resposta)</h2>
            {(duv ?? []).map((d) => (
              <form key={d.id} action={responder} className="mb-3 flex flex-col gap-1.5 text-sm">
                <H n={id} /><input type="hidden" name="id" value={d.id} />
                <p className="font-semibold">{d.pergunta}</p>
                <textarea name="resposta" defaultValue={d.resposta ?? ''} rows={2} className={campo + ' py-2'} required />
                <button className={btnSec + ' self-start'}>{d.resposta ? 'Atualizar resposta' : 'Responder'}</button>
              </form>
            ))}
          </Cartao>
        </div>
      </div>
    </>
  );
}
