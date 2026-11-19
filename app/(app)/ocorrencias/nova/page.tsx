import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { enviarArquivo, hojeISO, texto, voltar } from '@/lib/util';
import { Campo, Cartao, Flash, Titulo, btn, campo } from '@/components/ui';

async function registrar(f: FormData) {
  'use server';
  const s = await sessao();
  const sb = await supabaseServidor();
  const bloco = texto(f, 'bloco');
  const numero = texto(f, 'numero');
  const { data: un } = await sb.from('unidades').select('id').eq('bloco_id', bloco).eq('numero', numero).maybeSingle();
  if (!un) voltar('/ocorrencias/nova', { erro: `Unidade Bloco ${bloco} · ${numero} não existe.` });
  let foto: string | null = null;
  try { foto = await enviarArquivo(sb, f.get('foto'), 'ocorrencias'); } catch (e: any) { voltar('/ocorrencias/nova', { erro: e.message }); }
  const { error } = await sb.from('ocorrencias').insert({
    unidade_id: un!.id, enquadramento_id: texto(f, 'enquadramento') || null, fato: texto(f, 'fato'),
    data_fato: texto(f, 'data') || hojeISO(), foto_path: foto, registrada_por: s.userId,
  });
  if (error) voltar('/ocorrencias/nova', { erro: error.message });
  voltar('/ocorrencias/nova', { msg: 'Ocorrência enviada ao síndico. A unidade só é avisada depois da decisão.' });
}

export default async function NovaOcorrencia({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const sb = await supabaseServidor();
  const { data: enq } = await sb.from('enquadramentos').select('id, titulo').order('titulo');
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Descreva o fato com data, horário e local. O síndico analisa e decide; a unidade envolvida não vê quem registrou.">Registrar ocorrência</Titulo>
      <Cartao className="max-w-2xl">
        <form action={registrar} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Bloco"><select name="bloco" className={campo} required>{'ABCDEFGHIJ'.split('').map((b) => <option key={b}>{b}</option>)}</select></Campo>
            <Campo rotulo="Apartamento"><input name="numero" className={campo} inputMode="numeric" pattern="[1-4][0-9]{2}" required placeholder="Ex.: 308" /></Campo>
          </div>
          <Campo rotulo="Tipo">
            <select name="enquadramento" className={campo}>{(enq ?? []).map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}</select>
          </Campo>
          <Campo rotulo="Data do fato"><input type="date" name="data" className={campo} max={hojeISO()} defaultValue={hojeISO()} /></Campo>
          <Campo rotulo="O que aconteceu, quando e onde"><textarea name="fato" rows={5} className={campo + ' py-2'} required placeholder="Ex.: som alto às 23h40, relatado pelos aptos 307 e 309." /></Campo>
          <Campo rotulo="Foto ou vídeo (opcional)"><input type="file" name="foto" accept="image/*,video/*" className="text-sm" /></Campo>
          <button className={btn + ' self-start'}>Enviar ao síndico</button>
        </form>
      </Cartao>
    </>
  );
}
