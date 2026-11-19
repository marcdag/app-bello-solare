import { redirect } from 'next/navigation';
import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, rotuloTipo, texto, voltar } from '@/lib/util';
import { Cartao, Flash, Titulo, Vazio, btn, btnSec, campo } from '@/components/ui';

async function validarVinculo(f: FormData, aprovar: boolean) {
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('validar_vinculo', { p_id: texto(f, 'id'), p_aprovar: aprovar });
  if (error) voltar('/gestao/cadastros', { erro: error.message });
  voltar('/gestao/cadastros', { msg: aprovar ? 'Acesso liberado.' : 'Pedido recusado.' });
}
async function aprovarVinculo(f: FormData) { 'use server'; await validarVinculo(f, true); }
async function recusarVinculo(f: FormData) { 'use server'; await validarVinculo(f, false); }

async function validarItem(f: FormData, aprovar: boolean) {
  const sb = await supabaseServidor();
  const tabela = texto(f, 'tabela');
  if (!['pessoas', 'veiculos', 'pets'].includes(tabela)) return;
  const dados: Record<string, string> = { status: aprovar ? 'aprovado' : 'recusado' };
  if (tabela === 'veiculos' && texto(f, 'adesivo')) dados.adesivo = texto(f, 'adesivo');
  const { error } = await sb.from(tabela).update(dados).eq('id', texto(f, 'id'));
  if (error) voltar('/gestao/cadastros', { erro: error.message });
  voltar('/gestao/cadastros', { msg: 'Cadastro atualizado.' });
}
async function aprovarItem(f: FormData) { 'use server'; await validarItem(f, true); }
async function recusarItem(f: FormData) { 'use server'; await validarItem(f, false); }

export default async function Cadastros({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await sessao();
  if (!s.gestao && s.blocosSubsindico.length === 0) redirect('/');
  const sb = await supabaseServidor();
  const [{ data: vin }, { data: pes }, { data: vei }, { data: pet }] = await Promise.all([
    sb.from('vinculos').select('id, tipo, criado_em, perfis!vinculos_perfil_id_fkey(nome, telefone), unidades(bloco_id, numero)').eq('status', 'pendente').order('criado_em'),
    s.gestao ? sb.from('pessoas').select('*, unidades(bloco_id, numero)').eq('status', 'pendente') : { data: [] },
    s.gestao ? sb.from('veiculos').select('*, unidades(bloco_id, numero)').eq('status', 'pendente') : { data: [] },
    s.gestao ? sb.from('pets').select('*, unidades(bloco_id, numero)').eq('status', 'pendente') : { data: [] },
  ]);
  const un = (x: any) => `Bloco ${x.unidades?.bloco_id} · ${x.unidades?.numero}`;
  const Botoes = ({ sim, nao, extra }: { sim: any; nao: any; extra: React.ReactNode }) => (
    <form action={sim} className="mt-2 flex flex-wrap items-center gap-2">{extra}
      <button formAction={sim} className={btn}>Aprovar</button>
      <button formAction={nao} className={btnSec}>Recusar / pedir correção</button>
    </form>
  );
  const vazio = !(vin?.length || pes?.length || vei?.length || pet?.length);
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Confira com a portaria ou com a escritura/contrato antes de aprovar.">Cadastros a validar</Titulo>
      {vazio && <Vazio>Tudo validado.</Vazio>}
      <div className="grid gap-3 md:grid-cols-2">
        {(vin ?? []).map((v: any) => (
          <Cartao key={v.id}>
            <p className="font-bold">{v.perfis?.nome || 'Sem nome'} · {rotuloTipo[v.tipo] ?? v.tipo}</p>
            <p className="text-sm text-cinza-texto">Acesso ao app · {un(v)} · {v.perfis?.telefone ?? 'sem telefone'} · pedido em {dataBR(v.criado_em)}</p>
            <Botoes sim={aprovarVinculo} nao={recusarVinculo} extra={<input type="hidden" name="id" value={v.id} />} />
          </Cartao>
        ))}
        {(pes ?? []).map((p: any) => (
          <Cartao key={p.id}>
            <p className="font-bold">{p.nome}</p><p className="text-sm text-cinza-texto">Pessoa · {p.relacao.replaceAll('_', ' ')} · {un(p)}</p>
            <Botoes sim={aprovarItem} nao={recusarItem} extra={<><input type="hidden" name="id" value={p.id} /><input type="hidden" name="tabela" value="pessoas" /></>} />
          </Cartao>
        ))}
        {(vei ?? []).map((v: any) => (
          <Cartao key={v.id}>
            <p className="font-bold">{v.placa} · {v.modelo}{v.cor ? ` ${v.cor}` : ''}</p><p className="text-sm text-cinza-texto">Veículo · {un(v)}{v.vaga_numero ? ` · vaga ${v.vaga_numero}` : ' · sem vaga própria'}</p>
            <Botoes sim={aprovarItem} nao={recusarItem} extra={<><input type="hidden" name="id" value={v.id} /><input type="hidden" name="tabela" value="veiculos" /><input name="adesivo" placeholder="Nº do adesivo" defaultValue={v.adesivo ?? ''} className={campo + ' w-36'} /></>} />
          </Cartao>
        ))}
        {(pet ?? []).map((p: any) => (
          <Cartao key={p.id}>
            <p className="font-bold">{p.nome} · {p.especie}</p><p className="text-sm text-cinza-texto">Pet · {un(p)}{p.porte ? ` · porte ${p.porte}` : ''}</p>
            <Botoes sim={aprovarItem} nao={recusarItem} extra={<><input type="hidden" name="id" value={p.id} /><input type="hidden" name="tabela" value="pets" /></>} />
          </Cartao>
        ))}
      </div>
    </>
  );
}
