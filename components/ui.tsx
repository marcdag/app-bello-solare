import type { ReactNode } from 'react';
import { corStatus, rotuloStatus } from '@/lib/util';

export const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-royal px-4 text-[15px] font-bold text-white hover:bg-royal-escuro disabled:opacity-50';
export const btnSec = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cinza-campo bg-white px-4 text-[15px] font-bold text-tinta hover:bg-slate-50';
export const btnPerigo = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-[15px] font-bold text-white hover:bg-amber-800';
export const campo = 'min-h-11 w-full rounded-lg border border-cinza-campo bg-white px-3 text-[15px] text-tinta';

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-extrabold md:text-[28px]">{children}</h1>
      {sub && <p className="mt-1 text-[15px] text-cinza-texto">{sub}</p>}
    </div>
  );
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-cinza-borda bg-white p-4 md:p-5 ${className}`}>{children}</div>;
}

export function Selo({ status, texto }: { status: string; texto?: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${corStatus(status)}`}>
      {texto ?? rotuloStatus[status] ?? status}
    </span>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cinza-texto">
      {rotulo}
      {children}
      {dica && <span className="font-normal">{dica}</span>}
    </label>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-cinza-campo bg-white p-8 text-center text-[15px] text-cinza-texto">{children}</div>;
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'alerta' | 'ok'; children: ReactNode }) {
  const cor = tipo === 'alerta' ? 'bg-amber-50 text-amber-900' : tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-900';
  return <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${cor}`}>{children}</div>;
}

export function Flash({ sp }: { sp: { msg?: string; erro?: string } }) {
  if (sp.erro) return <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{sp.erro}</div>;
  if (sp.msg) return <div role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{sp.msg}</div>;
  return null;
}

export function Kpi({ valor, rotulo, cor = 'text-royal', href }: { valor: ReactNode; rotulo: string; cor?: string; href?: string }) {
  const corpo = (
    <>
      <span className={`text-3xl font-extrabold ${cor}`}>{valor}</span>
      <span className="text-sm font-semibold">{rotulo}</span>
    </>
  );
  const cls = 'flex flex-col gap-1 rounded-2xl border border-cinza-borda bg-white p-4 md:p-5';
  return href ? <a href={href} className={cls + ' hover:border-royal'}>{corpo}</a> : <div className={cls}>{corpo}</div>;
}
