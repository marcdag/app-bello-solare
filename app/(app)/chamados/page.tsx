import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataBR, enviarArquivo, texto, voltar } from '@/lib/util';
import { Aviso, Campo, Cartao, Flash, Selo, Titulo, Vazio, btn, campo } from '@/components/ui';

const CATEGORIAS = ['Elétrica', 'Hidráulica', 'Limpeza', 'Portões', 'Áreas comuns', 'Outros'];

async function abrir(f: FormData) {
  'use server';
  const s = await sessao();
  const sb = await supabaseServidor();
  const titulo = texto(f, 'titulo');
  if (!titulo) voltar('/chamados', { erro: 'Descreva o problema.' });
  let foto: string | null = null;
  try { foto = await enviarArquivo(sb, f.get('foto'), 'chamados'); } catch (e: any) { voltar('/chamados', { erro: e.message }); }
  const unidade = s.unidades.find((u) => u.unidade_id === texto(f, 'unidade'));
  const bloco = texto(f, 'bloco') || unidade?.bloco || null;
  const { error } = await sb.from('chamados').insert({
    aberto_por: s.userId, unidade_id: unidade?.unidade_id ?? null, bloco_id: bloco,
    local: texto(f, 'local') || (unidade ? unidade.rotulo : 'Área comum'),
    categoria: texto(f, 'categoria'), titulo, descricao: texto(f, 'descricao') || null, foto_path: foto,
  });
  if (error) voltar('/chamados', { erro: error.message });
  voltar('/chamados', { msg: 'Chamado enviado. O síndico e o subsíndico do bloco foram avisados.' });
}

export default async function Chamados({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await sessao();
  const sb = await supabaseServidor();
  const { data } = await sb.from('chamados').select('*').order('criado_em', { ascending: false }).limit(200);
  const todos = data ?? [];
  const meus = todos.filter((c) => c.aberto_por === s.userId);
  const abertos = todos.filter((c) => !['Concluído', 'Recusado'].includes(c.status) && c.aberto_por !== s.userId);
  const blocos = 'ABCDEFGHIJ'.split('');
  return (
    <>
      <Flash sp={sp} />
      <Titulo>Manutenção</Titulo>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Cartao className="lg:w-[420px] lg:shrink-0">
          <h2 id="novo" className="mb-3 text-lg font-extrabold">Novo chamado</h2>
          <form action={abrir} className="flex flex-col gap-3">
            <Campo rotulo="Categoria">
              <select name="categoria" className={campo} defaultValue="Elétrica">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
            </Campo>
            <Campo rotulo="O que aconteceu?"><input name="titulo" className={campo} required maxLength={120} placeholder="Ex.: lâmpada queimada no hall" /></Campo>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Campo rotulo="Local"><input name="local" className={campo} placeholder="Ex.: hall do 3º andar" /></Campo>
              <Campo rotulo="Bloco">
                <select name="bloco" className={campo} defaultValue={s.unidades[0]?.bloco ?? ''}>
                  <option value="">Área comum</option>{blocos.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Campo>
            </div>
            {s.unidades.length > 1 && (
              <Campo rotulo="Unidade"><select name="unidade" className={campo}>{s.unidades.map((u) => <option key={u.unidade_id} value={u.unidade_id}>{u.rotulo}</option>)}</select></Campo>
            )}
            {s.unidades.length === 1 && <input type="hidden" name="unidade" value={s.unidades[0].unidade_id} />}
            <Campo rotulo="Detalhes (opcional)"><textarea name="descricao" rows={3} className={campo + ' py-2'} /></Campo>
            <Campo rotulo="Foto (opcional)"><input type="file" name="foto" accept="image/*" capture="environment" className="text-sm" /></Campo>
            {abertos.length > 0 && <Aviso tipo="alerta">Antes de enviar, veja ao lado se o problema já foi reportado.</Aviso>}
            <button className={btn}>Enviar chamado</button>
          </form>
        </Cartao>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-lg font-extrabold">Meus chamados</h2>
          {meus.length === 0 && <Vazio>Você ainda não abriu chamados.</Vazio>}
          {meus.map((c) => <ItemChamado key={c.id} c={c} />)}
          <h2 className="mt-3 text-lg font-extrabold">Já reportados por outros moradores</h2>
          {abertos.length === 0 && <Vazio>Nenhum chamado aberto no momento.</Vazio>}
          {abertos.map((c) => <ItemChamado key={c.id} c={c} />)}
        </div>
      </div>
    </>
  );
}

function ItemChamado({ c }: { c: any }) {
  return (
    <Cartao>
      <div className="flex items-start justify-between gap-3"><span className="font-bold">{c.titulo}</span><Selo status={c.status} /></div>
      <p className="mt-1 text-sm text-cinza-texto">{c.categoria} · {c.local}{c.bloco_id ? ` · Bloco ${c.bloco_id}` : ''} · {dataBR(c.criado_em)}</p>
      {c.resposta && <p className="mt-2 rounded-lg bg-cinza-fundo px-3 py-2 text-sm"><strong>Resposta:</strong> {c.resposta}</p>}
    </Cartao>
  );
}
