import Link from 'next/link';
import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, linkArquivo, moeda, texto, voltar } from '@/lib/util';
import { Aviso, Campo, Cartao, Flash, Selo, Titulo, Vazio, btn, btnPerigo, btnSec, campo } from '@/components/ui';

async function decidir(f: FormData, decisao: 'notificacao' | 'multa' | 'arquivar') {
  const sb = await supabaseServidor();
  const id = texto(f, 'id');
  const { error } = await sb.rpc('decidir_ocorrencia', {
    p_id: id, p_enquadramento: texto(f, 'enquadramento') || null, p_decisao: decisao, p_percentual: Number(texto(f, 'percentual') || 100),
  });
  if (error) voltar(`/gestao/ocorrencias?id=${id}`, { erro: error.message });
  voltar(`/gestao/ocorrencias?id=${id}`, { msg: decisao === 'arquivar' ? 'Ocorrência arquivada.' : 'Decisão registrada. A unidade foi avisada no app.' });
}
async function notificar(f: FormData) { 'use server'; await decidir(f, 'notificacao'); }
async function multar(f: FormData) { 'use server'; await decidir(f, 'multa'); }
async function arquivar(f: FormData) { 'use server'; await decidir(f, 'arquivar'); }
async function escolha(f: FormData) { 'use server'; voltar(`/gestao/ocorrencias?id=${texto(f, 'id')}`, { erro: 'Escolha um dos botões: notificar, multar ou arquivar.' }); }

async function testemunhas(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const id = texto(f, 'id');
  const { error } = await sb.rpc('registrar_testemunhas', { p_id: id, p_texto: texto(f, 'texto') });
  if (error) voltar(`/gestao/ocorrencias?id=${id}`, { erro: error.message });
  voltar(`/gestao/ocorrencias?id=${id}`, { msg: 'Testemunhas registradas. A unidade é considerada notificada (RI Art. 82 §4º).' });
}

const FILTROS: Record<string, string[]> = {
  abertas: ['em_analise'], decididas: ['notificada', 'multada', 'em_recurso'], encerradas: ['arquivada', 'mantida', 'cancelada'],
};

export default async function Ocorrencias({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const sb = await supabaseServidor();
  const filtro = sp.f && FILTROS[sp.f] ? sp.f : 'abertas';
  const [{ data: lista }, { data: enq }, { data: taxa }] = await Promise.all([
    sb.from('ocorrencias').select('id, fato, status, data_fato, unidades(bloco_id, numero)').in('status', FILTROS[filtro]).order('criada_em', { ascending: false }).limit(200),
    sb.from('enquadramentos').select('*').order('titulo'),
    sb.from('configuracoes').select('valor').eq('chave', 'menor_taxa_condominial').single(),
  ]);
  let det: any = null, sug: any = null, foto: string | null = null;
  if (sp.id) {
    const { data } = await sb.from('ocorrencias').select('*, unidades(bloco_id, numero), enquadramentos(titulo, base_legal, multa_direta)').eq('id', sp.id).single();
    det = data;
    if (det) {
      const r = await sb.rpc('sugerir_penalidade', { p_ocorrencia: det.id });
      sug = r.data?.[0];
      foto = await linkArquivo(sb, det.foto_path);
    }
  }
  const menorTaxa = Number(taxa?.valor ?? 0);
  return (
    <>
      <Flash sp={sp} />
      <Titulo>Ocorrências e penalidades</Titulo>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(FILTROS).map((k) => <Link key={k} href={`/gestao/ocorrencias?f=${k}`} className={k === filtro ? btn : btnSec}>{k[0].toUpperCase() + k.slice(1)}</Link>)}
      </div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-2 lg:w-[380px] lg:shrink-0">
          {(lista ?? []).length === 0 && <Vazio>Nada aqui.</Vazio>}
          {(lista ?? []).map((o: any) => (
            <Link key={o.id} href={`/gestao/ocorrencias?f=${filtro}&id=${o.id}`}>
              <Cartao className={`flex flex-col gap-1 hover:border-royal ${o.id === sp.id ? 'border-2 border-royal' : ''}`}>
                <span className="flex items-start justify-between gap-2"><span className="font-bold">Bloco {o.unidades?.bloco_id} · {o.unidades?.numero}</span><Selo status={o.status} /></span>
                <span className="line-clamp-2 text-sm">{o.fato}</span>
                <span className="text-xs text-cinza-texto">{dataBR(o.data_fato)}</span>
              </Cartao>
            </Link>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          {!det && <Vazio>Selecione uma ocorrência para ver o enquadramento e a penalidade sugerida.</Vazio>}
          {det && (
            <Cartao className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-extrabold">Bloco {det.unidades?.bloco_id} · {det.unidades?.numero}</h2>
                <Selo status={det.status} />
              </div>
              <div className="grid gap-4 text-sm md:grid-cols-2">
                <Info r="Fato">{det.fato}</Info>
                <Info r="Data">{dataBR(det.data_fato)} (registrada em {dataBR(det.criada_em)})</Info>
                <Info r="Enquadramento">{det.enquadramentos ? `${det.enquadramentos.titulo} — ${det.enquadramentos.base_legal}` : 'Não informado'}</Info>
                <Info r="Histórico da unidade (12 meses)">{sug ? `${sug.historico} penalidade(s) anterior(es)` : '—'}</Info>
              </div>
              {foto && <img src={foto} alt="Evidência" className="max-h-72 self-start rounded-lg" />}
              {sug && det.status === 'em_analise' && (
                <div className="rounded-2xl bg-blue-50 p-4 text-blue-900">
                  <p className="text-xs font-bold uppercase tracking-wide">Penalidade sugerida</p>
                  <p className="text-lg font-extrabold">{sug.penalidade === 'multa' ? `Multa de ${Number(sug.percentual)}% da menor taxa${menorTaxa ? ` (${moeda((menorTaxa * Number(sug.percentual)) / 100)})` : ''}` : 'Notificação por escrito'}</p>
                  <p className="text-sm">{sug.fundamento}</p>
                </div>
              )}
              {det.status === 'em_analise' && (
                <form action={escolha} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={det.id} />
                  {/* botão padrão (Enter): não decide nada, só pede a escolha */}
                  <button type="submit" formAction={escolha} className="sr-only" tabIndex={-1} aria-hidden="true">Enviar</button>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Campo rotulo="Enquadramento">
                      <select name="enquadramento" className={campo} defaultValue={det.enquadramento_id ?? ''}>
                        {(enq ?? []).map((e) => <option key={e.id} value={e.id}>{e.titulo}{e.multa_direta ? ' (multa direta)' : ''}</option>)}
                      </select>
                    </Campo>
                    <Campo rotulo="Multa (% da menor taxa, até 500%)">
                      <input name="percentual" type="number" min={0} max={500} step={10} defaultValue={sug?.percentual ?? 100} className={campo} />
                    </Campo>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button formAction={notificar} className={btn}>Emitir notificação</button>
                    <button formAction={multar} className={btnPerigo}>Aplicar multa</button>
                    <button formAction={arquivar} className={btnSec}>Arquivar</button>
                  </div>
                  <p className="text-xs text-cinza-texto">Se mudar o enquadramento, a sugestão acima pode mudar: salve como notificação ou multa conforme o Regimento. Casos reiterados graves (RI Art. 96) vão à assembleia.</p>
                </form>
              )}
              {['notificada', 'multada'].includes(det.status) && (
                <>
                  <Aviso>Decidida em {dataBR(det.decidida_em)}. {det.ciencia_em ? `Ciência em ${dataBR(det.ciencia_em)}.` : 'Sem ciência ainda.'} Prazo de recurso ao Conselho: até {new Date(new Date(det.decidida_em).getTime() + 10 * 864e5).toLocaleDateString('pt-BR')}.{det.penalidade === 'multa' ? ' Inclua na lista de multas do mês enviada à administradora (vão para o fundo de reserva).' : ''}</Aviso>
                  {!det.ciencia_em && (
                    <form action={testemunhas} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={det.id} />
                      <Campo rotulo="Unidade recusou ou não foi encontrada? Registre 2 testemunhas (nome e documento)"><textarea name="texto" rows={2} className={campo + ' py-2'} required /></Campo>
                      <button className={btnSec + ' self-start'}>Registrar testemunhas</button>
                    </form>
                  )}
                </>
              )}
              {det.testemunhas && <Info r="Testemunhas">{det.testemunhas}</Info>}
              {det.recurso_texto && <Aviso tipo="alerta">Recurso da unidade ({dataBR(det.recurso_em)}): {det.recurso_texto}</Aviso>}
              {det.julgamento_texto && <Aviso tipo="ok">Conselho ({dataBR(det.julgada_em)}): {det.julgamento_texto}</Aviso>}
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ r, children }: { r: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-cinza-texto">{r}</p><p className="leading-relaxed">{children}</p></div>;
}
