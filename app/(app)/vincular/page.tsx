import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { texto, voltar } from '@/lib/util';
import { Aviso, Campo, Cartao, Flash, Titulo, btn, campo } from '@/components/ui';

async function vincular(f: FormData) {
  'use server';
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('solicitar_vinculo', { p_codigo: texto(f, 'codigo'), p_tipo: texto(f, 'tipo') });
  if (error) voltar('/vincular', { erro: error.message });
  voltar('/vincular', { msg: `Pedido enviado para ${data}. Você recebe um aviso quando o síndico validar.` });
}

export default async function Vincular({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await sessao();
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub="Use o código de convite da sua unidade. Peça à administração ou à portaria se ainda não recebeu.">Vincular minha unidade</Titulo>
      {s.pendentes.length > 0 && <div className="mb-4"><Aviso>Aguardando validação do síndico: {s.pendentes.map((p) => p.rotulo).join(', ')}.</Aviso></div>}
      {s.unidades.length > 0 && <div className="mb-4"><Aviso tipo="ok">Você já está vinculado a: {s.unidades.map((u) => u.rotulo).join(', ')}.</Aviso></div>}
      <Cartao className="max-w-lg">
        <form action={vincular} className="flex flex-col gap-4">
          <Campo rotulo="Código de convite (8 caracteres)">
            <input name="codigo" className={campo + ' uppercase tracking-widest'} maxLength={8} minLength={8} required autoComplete="off" />
          </Campo>
          <Campo rotulo="Você é">
            <select name="tipo" className={campo} required defaultValue="proprietario">
              <option value="proprietario">Proprietário(a)</option>
              <option value="morador">Morador(a) da família do proprietário</option>
              <option value="inquilino">Inquilino(a)</option>
            </select>
          </Campo>
          <button className={btn}>Enviar pedido</button>
        </form>
      </Cartao>
    </>
  );
}
