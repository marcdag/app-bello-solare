'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type ItemMenu = { href: string; rotulo: string; grupo: string };

export function Menu({ itens }: { itens: ItemMenu[] }) {
  const atual = usePathname();
  const ativo = (h: string) => (h === '/' ? atual === '/' : atual === h || atual.startsWith(h + '/'));
  const grupos = [...new Set(itens.map((i) => i.grupo))];
  return (
    <>
      {/* Celular: faixa rolável abaixo do cabeçalho */}
      <nav aria-label="Menu" className="flex gap-1 overflow-x-auto border-b border-cinza-borda bg-white px-2 py-2 md:hidden">
        {itens.map((i) => (
          <Link key={i.href} href={i.href}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold ${ativo(i.href) ? 'bg-royal text-white' : 'text-cinza-texto'}`}>
            {i.rotulo}
          </Link>
        ))}
      </nav>
      {/* Computador: menu lateral */}
      <nav aria-label="Menu" className="hidden w-64 shrink-0 flex-col gap-4 border-r border-cinza-borda bg-white p-4 md:flex">
        {grupos.map((g) => (
          <div key={g} className="flex flex-col gap-1">
            {grupos.length > 1 && <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-cinza-texto">{g}</span>}
            {itens.filter((i) => i.grupo === g).map((i) => (
              <Link key={i.href} href={i.href}
                className={`flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold ${ativo(i.href) ? 'bg-royal-claro font-extrabold text-royal-escuro' : 'text-cinza-texto hover:bg-slate-50'}`}>
                {i.rotulo}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
