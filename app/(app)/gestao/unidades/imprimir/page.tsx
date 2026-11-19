import { exigir } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';

// Bilhetes para recortar e entregar em cada apartamento (Ctrl+P / Imprimir)
export default async function Imprimir({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await exigir('gestao');
  const sb = await supabaseServidor();
  const { data } = await sb.rpc('codigos_convite');
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const lista = (data ?? []).filter((c: any) => !sp.bloco || c.bloco === sp.bloco);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
      <p className="col-span-full text-sm text-cinza-texto print:hidden">Use “Imprimir” no navegador. Filtre por bloco acrescentando ?bloco=A ao endereço.</p>
      {lista.map((c: any) => (
        <div key={c.unidade_id} className="break-inside-avoid rounded-xl border-2 border-dashed border-cinza-campo bg-white p-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-12 w-12 object-contain" />
            <div><p className="font-extrabold">App do Parque Bello Solare</p><p className="text-sm">Bloco {c.bloco} · Apto {c.numero}</p></div>
          </div>
          <p className="mt-3 text-sm">1. Acesse <strong>{site.replace(/^https?:\/\//, '') || 'o app do condomínio'}</strong> e crie sua conta.</p>
          <p className="text-sm">2. Em “Vincular unidade”, digite o código:</p>
          <p className="mt-1 text-center font-mono text-2xl font-extrabold tracking-[0.3em]">{c.codigo}</p>
          <p className="mt-2 text-xs text-cinza-texto">Código pessoal da unidade. Não compartilhe fora da sua família.</p>
        </div>
      ))}
    </div>
  );
}
