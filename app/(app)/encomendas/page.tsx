import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { dataHoraBR, linkArquivo } from '@/lib/util';
import { Cartao, Selo, Titulo, Vazio } from '@/components/ui';

export default async function Encomendas() {
  await exigir('membro');
  const sb = await supabaseServidor();
  const { data } = await sb.rpc('minhas_encomendas');
  const lista = await Promise.all((data ?? []).map(async (e: any) => ({ ...e, foto: await linkArquivo(sb, e.foto_path) })));
  return (
    <>
      <Titulo sub="Mostre o código ao porteiro para retirar.">Encomendas</Titulo>
      {lista.length === 0 && <Vazio>Nenhuma encomenda registrada para a sua unidade.</Vazio>}
      <div className="grid gap-3 md:grid-cols-2">
        {lista.map((e: any) => (
          <Cartao key={e.id} className={e.retirada_em ? 'opacity-75' : ''}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">{e.descricao}</span>
                <span className="text-sm text-cinza-texto">{e.unidade} · chegou {dataHoraBR(e.registrada_em)}</span>
              </div>
              <Selo status={e.retirada_em ? 'Retirada' : 'Na portaria'} />
            </div>
            {e.foto && <img src={e.foto} alt="Foto da etiqueta" className="mt-3 max-h-48 rounded-lg object-contain" />}
            {!e.retirada_em ? (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-cinza-fundo px-4 py-3">
                <span className="text-sm font-semibold text-cinza-texto">Código de retirada</span>
                <span className="text-3xl font-extrabold tracking-[0.2em] text-royal">{e.codigo_retirada}</span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-cinza-texto">Retirada em {dataHoraBR(e.retirada_em)}{e.retirada_por_nome ? ` por ${e.retirada_por_nome}` : ''}</p>
            )}
          </Cartao>
        ))}
      </div>
    </>
  );
}
