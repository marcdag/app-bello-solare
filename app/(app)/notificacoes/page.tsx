import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, linkArquivo, texto, voltar } from '@/lib/util';
import { Aviso, Campo, Cartao, Flash, Selo, Titulo, Vazio, btn, btnSec, campo } from '@/components/ui';

async function ciencia(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('dar_ciencia', { p_id: texto(f, 'id') });
  if (error) voltar('/notificacoes', { erro: error.message });
  voltar('/notificacoes', { msg: 'Ciência registrada.' });
}

async function recorrer(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('recorrer', { p_id: texto(f, 'id'), p_texto: texto(f, 'texto') });
  if (error) voltar('/notificacoes', { erro: error.message });
  voltar('/notificacoes', { msg: 'Recurso enviado. O Conselho Consultivo/Fiscal julga em até 10 dias (RI Art. 82 §5º).' });
}

export default async function Notificacoes({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await exigir('membro');
  const sb = await supabaseServidor();
  const { data } = await sb.from('ocorrencias').select('*, enquadramentos(titulo, base_legal)')
    .in('unidade_id', s.unidades.map((u) => u.unidade_id)).order('decidida_em', { ascending: false });
  const lista = await Promise.all((data ?? []).map(async (o) => ({ ...o, foto: await linkArquivo(sb, o.foto_path) })));
  const prazo = (d: string) => new Date(new Date(d).getTime() + 10 * 864e5);
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Notificações e multas da sua unidade. Você pode recorrer ao Conselho em até 10 dias corridos da decisão.">Notificações</Titulo>
      {lista.length === 0 && <Vazio>Nenhuma notificação para a sua unidade.</Vazio>}
      <div className="flex flex-col gap-4">
        {lista.map((o: any) => {
          const podeRecorrer = ['notificada', 'multada'].includes(o.status) && o.decidida_em && new Date() <= prazo(o.decidida_em);
          return (
            <Cartao key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-extrabold">{o.penalidade === 'multa' ? `Multa de ${Number(o.multa_percentual)}% da menor taxa` : 'Notificação por escrito'}</h2>
                <Selo status={o.status} />
              </div>
              <p className="mt-2 text-[15px]">{o.fato} <span className="text-cinza-texto">({dataBR(o.data_fato)})</span></p>
              {o.enquadramentos && <p className="mt-1 text-sm text-cinza-texto">Enquadramento: {o.enquadramentos.titulo} — {o.enquadramentos.base_legal}</p>}
              {o.foto && <img src={o.foto} alt="Evidência" className="mt-3 max-h-56 rounded-lg" />}
              <p className="mt-2 text-sm text-cinza-texto">Decidida em {dataBR(o.decidida_em)}. {o.ciencia_em ? `Ciência em ${dataBR(o.ciencia_em)}.` : ''}</p>
              {o.recurso_texto && <div className="mt-3"><Aviso>Seu recurso ({dataBR(o.recurso_em)}): {o.recurso_texto}</Aviso></div>}
              {o.julgamento_texto && <div className="mt-3"><Aviso tipo={o.status === 'cancelada' ? 'ok' : 'alerta'}>Decisão do Conselho: {o.julgamento_texto}</Aviso></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {!o.ciencia_em && <form action={ciencia}><input type="hidden" name="id" value={o.id} /><button className={btn}>Dar ciência</button></form>}
              </div>
              {podeRecorrer && (
                <details className="mt-3">
                  <summary className={btnSec + ' cursor-pointer list-none'}>Recorrer ao Conselho (até {prazo(o.decidida_em).toLocaleDateString('pt-BR')})</summary>
                  <form action={recorrer} className="mt-3 flex flex-col gap-2">
                    <input type="hidden" name="id" value={o.id} />
                    <Campo rotulo="Sua defesa"><textarea name="texto" rows={4} className={campo + ' py-2'} required /></Campo>
                    <button className={btn + ' self-start'}>Enviar recurso</button>
                  </form>
                </details>
              )}
            </Cartao>
          );
        })}
      </div>
    </>
  );
}
