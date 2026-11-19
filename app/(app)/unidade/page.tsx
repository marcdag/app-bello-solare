import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, hojeISO, rotuloTipo, texto, voltar } from '@/lib/util';
import { Aviso, Campo, Cartao, Flash, Selo, Titulo, btn, btnSec, campo } from '@/components/ui';

const volta = (u: string, o: { msg?: string; erro?: string }) => voltar(`/unidade?u=${u}`, o);

async function adicionar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const u = texto(f, 'unidade');
  const tipo = texto(f, 'tipo');
  let r;
  if (tipo === 'pessoa') {
    r = await sb.from('pessoas').insert({ unidade_id: u, nome: texto(f, 'nome'), relacao: texto(f, 'relacao'), telefone: texto(f, 'telefone') || null, endereco_correspondencia: texto(f, 'endereco') || null });
  } else if (tipo === 'veiculo') {
    const placa = texto(f, 'placa').toUpperCase().replace(/[^A-Z0-9]/g, '');
    r = await sb.from('veiculos').insert({ unidade_id: u, placa, modelo: texto(f, 'modelo'), cor: texto(f, 'cor') || null, vaga_numero: Number(texto(f, 'vaga')) || null });
    if (r.error?.message.includes('placa')) volta(u, { erro: 'Placa inválida. Use o formato ABC1D23 ou ABC1234.' });
    if (r.error?.code === '23505') volta(u, { erro: 'Essa placa já está cadastrada.' });
  } else {
    r = await sb.from('pets').insert({ unidade_id: u, nome: texto(f, 'nome'), especie: texto(f, 'especie'), porte: texto(f, 'porte') || null });
  }
  if (r.error) volta(u, { erro: r.error.message });
  volta(u, { msg: 'Enviado para validação do síndico.' });
}

async function remover(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const tabela = texto(f, 'tabela');
  if (!['pessoas', 'veiculos', 'pets'].includes(tabela)) return;
  const { error } = await sb.from(tabela).delete().eq('id', texto(f, 'id'));
  if (error) volta(texto(f, 'unidade'), { erro: error.message });
  volta(texto(f, 'unidade'), { msg: 'Removido.' });
}

async function confirmar(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const u = texto(f, 'unidade');
  const { error } = await sb.from('unidades').update({ cadastro_revisado_em: hojeISO() }).eq('id', u);
  if (error) volta(u, { erro: error.message });
  volta(u, { msg: 'Cadastro confirmado. Revise de novo em 6 meses ou quando algo mudar.' });
}

export default async function Unidade({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await exigir('membro');
  const atual = s.unidades.find((u) => u.unidade_id === sp.u) ?? s.unidades[0];
  const id = atual.unidade_id;
  const sb = await supabaseServidor();
  const [{ data: un }, { data: vagas }, { data: pessoas }, { data: veiculos }, { data: pets }, { data: vinculos }] = await Promise.all([
    sb.from('unidades').select('cadastro_revisado_em').eq('id', id).single(),
    sb.from('vagas').select('numero, posicao').eq('unidade_id', id).order('numero'),
    sb.from('pessoas').select('*').eq('unidade_id', id).order('criado_em'),
    sb.from('veiculos').select('*').eq('unidade_id', id).order('criado_em'),
    sb.from('pets').select('*').eq('unidade_id', id).order('criado_em'),
    sb.from('vinculos').select('id, tipo, status, perfis!vinculos_perfil_id_fkey(nome)').eq('unidade_id', id).eq('status', 'aprovado'),
  ]);
  const Remover = ({ tabela, idItem }: { tabela: string; idItem: string }) => (
    <form action={remover}><input type="hidden" name="tabela" value={tabela} /><input type="hidden" name="id" value={idItem} /><input type="hidden" name="unidade" value={id} />
      <button className="min-h-11 px-2 text-sm font-bold text-red-700">Remover</button></form>
  );
  return (
    <>
      <Flash sp={sp} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold md:text-[28px]">{atual.rotulo}</h1>
        <form action={confirmar}><input type="hidden" name="unidade" value={id} /><button className={btn}>Confirmar que está tudo certo</button></form>
      </div>
      {s.unidades.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">{s.unidades.map((u) => <a key={u.unidade_id} href={`/unidade?u=${u.unidade_id}`} className={u.unidade_id === id ? btn : btnSec}>{u.rotulo}</a>)}</div>
      )}
      <Aviso tipo="alerta">Última revisão do cadastro: {un?.cadastro_revisado_em ? dataBR(un.cadastro_revisado_em) : 'nunca'}. Cadastro desatualizado é infração com multa direta (RI Art. 82).</Aviso>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <h2 className="mb-2 text-lg font-extrabold">Com acesso ao app</h2>
          {(vinculos ?? []).map((v: any) => <p key={v.id} className="flex justify-between text-sm"><span>{v.perfis?.nome ?? '—'}</span><span className="text-cinza-texto">{rotuloTipo[v.tipo] ?? v.tipo}</span></p>)}
          <h3 className="mb-2 mt-4 font-extrabold">Outros moradores e contatos</h3>
          {(pessoas ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{p.nome} <span className="text-cinza-texto">· {p.relacao.replaceAll('_', ' ')}</span></span>
              <span className="flex items-center gap-1"><Selo status={p.status} /><Remover tabela="pessoas" idItem={p.id} /></span>
            </div>
          ))}
          <details className="mt-2"><summary className={btnSec + ' cursor-pointer list-none'}>+ Adicionar pessoa</summary>
            <form action={adicionar} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="unidade" value={id} /><input type="hidden" name="tipo" value="pessoa" />
              <Campo rotulo="Nome"><input name="nome" className={campo} required /></Campo>
              <Campo rotulo="Relação">
                <select name="relacao" className={campo}>
                  <option value="morador">Morador(a)</option><option value="dependente">Dependente</option>
                  <option value="contato_emergencia">Contato de emergência (RI Art. 8º IX)</option>
                  <option value="proprietario_nao_residente">Proprietário que não reside</option>
                </select>
              </Campo>
              <Campo rotulo="Telefone (opcional)"><input name="telefone" className={campo} inputMode="tel" /></Campo>
              <Campo rotulo="Endereço para correspondência (proprietário que não reside)"><input name="endereco" className={campo} /></Campo>
              <button className={btn + ' self-start'}>Enviar</button>
            </form>
          </details>
        </Cartao>
        <Cartao>
          <h2 className="mb-2 text-lg font-extrabold">Vagas e veículos</h2>
          <p className="text-sm text-cinza-texto">Vaga(s) da unidade pela Convenção: <strong className="text-tinta">{(vagas ?? []).map((v) => v.numero).join(' e ') || '—'}</strong></p>
          <div className="mt-2 flex flex-col gap-1">
            {(veiculos ?? []).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                <span><strong>{v.placa}</strong> · {v.modelo}{v.cor ? ` ${v.cor}` : ''}{v.vaga_numero ? ` · vaga ${v.vaga_numero}` : ''}{v.adesivo ? ` · adesivo ${v.adesivo}` : ''}</span>
                <span className="flex items-center gap-1"><Selo status={v.status} /><Remover tabela="veiculos" idItem={v.id} /></span>
              </div>
            ))}
          </div>
          <details className="mt-2"><summary className={btnSec + ' cursor-pointer list-none'}>+ Adicionar veículo</summary>
            <form action={adicionar} className="mt-3 grid grid-cols-2 gap-2">
              <input type="hidden" name="unidade" value={id} /><input type="hidden" name="tipo" value="veiculo" />
              <Campo rotulo="Placa"><input name="placa" className={campo + ' uppercase'} required maxLength={8} /></Campo>
              <Campo rotulo="Vaga">
                <select name="vaga" className={campo}>{(vagas ?? []).map((v) => <option key={v.numero} value={v.numero}>{v.numero}</option>)}<option value="">Outra (com autorização)</option></select>
              </Campo>
              <Campo rotulo="Modelo"><input name="modelo" className={campo} required /></Campo>
              <Campo rotulo="Cor"><input name="cor" className={campo} /></Campo>
              <p className="col-span-2 text-xs text-cinza-texto">Vagas só para carros de pequeno e médio porte (Conv. Art. 6.1 c). Usar vaga de outra unidade exige autorização escrita do proprietário (RI Art. 9º XXXV).</p>
              <button className={btn + ' col-span-2 justify-self-start'}>Enviar</button>
            </form>
          </details>
        </Cartao>
        <Cartao>
          <h2 className="mb-2 text-lg font-extrabold">Pets</h2>
          {(pets ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{p.nome} · {p.especie}{p.porte ? `, porte ${p.porte}` : ''}</span>
              <span className="flex items-center gap-1"><Selo status={p.status} /><Remover tabela="pets" idItem={p.id} /></span>
            </div>
          ))}
          <details className="mt-2"><summary className={btnSec + ' cursor-pointer list-none'}>+ Adicionar pet</summary>
            <form action={adicionar} className="mt-3 grid grid-cols-2 gap-2">
              <input type="hidden" name="unidade" value={id} /><input type="hidden" name="tipo" value="pet" />
              <Campo rotulo="Nome"><input name="nome" className={campo} required /></Campo>
              <Campo rotulo="Espécie"><input name="especie" className={campo} required placeholder="cão, gato…" /></Campo>
              <Campo rotulo="Porte"><select name="porte" className={campo}><option value="pequeno">Pequeno</option><option value="medio">Médio</option><option value="grande">Grande</option></select></Campo>
              <button className={btn + ' col-span-2 justify-self-start'}>Enviar</button>
            </form>
          </details>
        </Cartao>
      </div>
    </>
  );
}
