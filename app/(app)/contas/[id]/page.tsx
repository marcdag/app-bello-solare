import { notFound } from 'next/navigation';
import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, linkArquivo, mesAno, texto, voltar } from '@/lib/util';
import { ResumoContas } from '@/components/Contas';
import { Aviso, Campo, Cartao, Flash, Selo, Titulo, btn, btnSec, campo } from '@/components/ui';

async function perguntar(f: FormData) {
  'use server';
  const s = await sessao();
  const sb = await supabaseServidor();
  const id = texto(f, 'conta');
  const pergunta = texto(f, 'pergunta');
  if (!pergunta) voltar(`/contas/${id}`, { erro: 'Escreva sua dúvida.' });
  const { error } = await sb.from('contas_duvidas').insert({ conta_id: id, perfil_id: s.userId, pergunta });
  if (error) voltar(`/contas/${id}`, { erro: error.message });
  voltar(`/contas/${id}`, { msg: 'Dúvida enviada. A resposta fica visível para todos os moradores.' });
}

async function parecer(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const id = texto(f, 'conta');
  const { error } = await sb.rpc('registrar_parecer', { p_conta: id, p_texto: texto(f, 'texto') });
  if (error) voltar(`/contas/${id}`, { erro: error.message });
  voltar(`/contas/${id}`, { msg: 'Parecer registrado. Os moradores já podem ver.' });
}

export default async function Conta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await sessao();
  const sb = await supabaseServidor();
  const [{ data: conta }, { data: lanc }, { data: docs }, { data: duvidas }] = await Promise.all([
    sb.from('contas_mensais').select('*').eq('id', id).single(),
    sb.from('contas_lancamentos').select('tipo, categoria, valor').eq('conta_id', id),
    sb.from('contas_documentos').select('*').eq('conta_id', id),
    sb.from('contas_duvidas').select('id, pergunta, resposta, criada_em, respondida_em').eq('conta_id', id).order('criada_em'),
  ]);
  if (!conta) notFound();
  const links = await Promise.all((docs ?? []).map(async (d) => ({ ...d, url: await linkArquivo(sb, d.arquivo_path) })));
  return (
    <>
      <Flash sp={sp} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold capitalize md:text-[28px]">Contas de {mesAno(conta.competencia)}</h1>
        <Selo status={conta.status} />
      </div>
      <p className="mb-4 text-sm text-cinza-texto">
        {conta.status === 'aprovada' ? `Parecer favorável do Conselho Fiscal em ${dataBR(conta.parecer_em)}.` : conta.publicada_em ? `Publicada em ${dataBR(conta.publicada_em)}. O Conselho Fiscal analisa e emite parecer.` : 'Rascunho (visível só para a gestão e o Conselho).'}
      </p>
      <ResumoContas conta={conta} lancamentos={(lanc ?? []) as any} />
      {conta.observacoes && <div className="mt-4"><Aviso>{conta.observacoes}</Aviso></div>}
      {conta.parecer_texto && <div className="mt-4"><Aviso tipo="ok"><strong>Parecer do Conselho:</strong> {conta.parecer_texto}</Aviso></div>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 text-lg font-extrabold">Documentos do mês</h2>
          {links.length === 0 && <p className="text-sm text-cinza-texto">Nenhum documento anexado.</p>}
          <div className="flex flex-col gap-2">
            {links.map((d) => d.url && <a key={d.id} href={d.url} target="_blank" rel="noopener" className={btnSec + ' justify-start text-royal'}>{d.titulo}</a>)}
          </div>
        </Cartao>
        <Cartao>
          <h2 className="mb-3 text-lg font-extrabold">Dúvidas dos moradores</h2>
          <div className="flex flex-col gap-3">
            {(duvidas ?? []).map((d) => (
              <div key={d.id} className="text-sm">
                <p className="font-semibold">{d.pergunta}</p>
                <p className="text-cinza-texto">{d.resposta ? `Resposta: ${d.resposta}` : 'Aguardando resposta da administração.'}</p>
              </div>
            ))}
          </div>
          {conta.status !== 'rascunho' && (
            <form action={perguntar} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="conta" value={id} />
              <Campo rotulo="Sua dúvida"><textarea name="pergunta" rows={3} className={campo + ' py-2'} required /></Campo>
              <button className={btn + ' self-start'}>Enviar ao síndico</button>
            </form>
          )}
        </Cartao>
      </div>
      {s.conselho && conta.status === 'publicada' && (
        <Cartao className="mt-4">
          <h2 className="mb-3 text-lg font-extrabold">Parecer do Conselho Fiscal</h2>
          <form action={parecer} className="flex flex-col gap-3">
            <input type="hidden" name="conta" value={id} />
            <Campo rotulo="Texto do parecer"><textarea name="texto" rows={3} className={campo + ' py-2'} required placeholder="Ex.: contas examinadas e consideradas regulares." /></Campo>
            <button className={btn + ' self-start'}>Registrar parecer favorável</button>
          </form>
        </Cartao>
      )}
    </>
  );
}
