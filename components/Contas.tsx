import { moeda } from '@/lib/util';
import { Cartao } from './ui';

type Lanc = { tipo: 'receita' | 'despesa'; categoria: string; valor: number | string };

/** Resumo da prestação de contas: totais, barras por categoria e receitas. */
export function ResumoContas({ conta, lancamentos }: { conta: any; lancamentos: Lanc[] }) {
  const rec = lancamentos.filter((l) => l.tipo === 'receita');
  const desp = lancamentos.filter((l) => l.tipo === 'despesa').sort((a, b) => Number(b.valor) - Number(a.valor));
  const totR = rec.reduce((a, l) => a + Number(l.valor), 0);
  const totD = desp.reduce((a, l) => a + Number(l.valor), 0);
  const res = totR - totD;
  const max = Math.max(1, ...desp.map((d) => Number(d.valor)));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Bloco rotulo="Receitas" valor={moeda(totR)} />
        <Bloco rotulo="Despesas" valor={moeda(totD)} />
        <Bloco rotulo="Resultado do mês" valor={(res >= 0 ? '+ ' : '− ') + moeda(Math.abs(res))} cor={res >= 0 ? 'text-green-700' : 'text-red-700'} />
        <Bloco rotulo="Fundo de reserva" valor={conta.fundo_reserva != null ? moeda(conta.fundo_reserva) : '—'} />
      </div>
      {conta.inadimplencia_pct != null && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Inadimplência: {Number(conta.inadimplencia_pct).toLocaleString('pt-BR')}% das unidades em atraso (cerca de {Math.round((368 * Number(conta.inadimplencia_pct)) / 100)} de 368).
        </p>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Cartao>
          <h2 className="mb-3 text-lg font-extrabold">Para onde foi o dinheiro</h2>
          {desp.length === 0 && <p className="text-sm text-cinza-texto">Sem despesas lançadas.</p>}
          <div className="flex flex-col gap-3">
            {desp.map((d, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex justify-between gap-2 text-sm"><span>{d.categoria}</span>
                  <span className="whitespace-nowrap font-bold">{moeda(d.valor)} · {totD ? Math.round((Number(d.valor) / totD) * 100) : 0}%</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-royal" style={{ width: `${(Number(d.valor) / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Cartao>
        <Cartao>
          <h2 className="mb-3 text-lg font-extrabold">De onde veio o dinheiro</h2>
          {rec.length === 0 && <p className="text-sm text-cinza-texto">Sem receitas lançadas.</p>}
          <div className="flex flex-col gap-2">
            {rec.map((r, i) => <div key={i} className="flex justify-between gap-2 text-sm"><span>{r.categoria}</span><span className="font-bold">{moeda(r.valor)}</span></div>)}
          </div>
        </Cartao>
      </div>
    </>
  );
}

function Bloco({ rotulo, valor, cor = '' }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-cinza-borda bg-white p-4">
      <span className="text-xs font-semibold text-cinza-texto">{rotulo}</span>
      <span className={`text-lg font-extrabold md:text-2xl ${cor}`}>{valor}</span>
    </div>
  );
}
