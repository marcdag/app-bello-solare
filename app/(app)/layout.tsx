import Link from 'next/link';
import { sessao } from '@/lib/sessao';
import { Menu, type ItemMenu } from '@/components/Menu';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await sessao();
  // Sem unidade aprovada nem papel de equipe: só vê "Vincular unidade", avisos e perfil
  const semAcesso = s.unidades.length === 0 && !s.equipe && !s.conselho && s.blocosSubsindico.length === 0;

  const itens: ItemMenu[] = [];
  const add = (href: string, rotulo: string, grupo: string) => {
    if (!itens.some((i) => i.href === href)) itens.push({ href, rotulo, grupo });
  };
  if (s.unidades.length > 0) {
    add('/', 'Início', 'Morador');
    add('/encomendas', 'Encomendas', 'Morador');
    add('/chamados', 'Manutenção', 'Morador');
    add('/reservas', 'Reservas', 'Morador');
    add('/contas', 'Prestação de contas', 'Morador');
    add('/notificacoes', 'Notificações', 'Morador');
    add('/unidade', 'Minha unidade', 'Morador');
    add('/ocorrencias/nova', 'Relatar ocorrência', 'Morador');
  }
  if (s.papeis.includes('portaria') || s.gestao) {
    add('/portaria', 'Encomendas', 'Portaria');
    add('/portaria/consulta', 'Consultar placa/unidade', 'Portaria');
    add('/ocorrencias/nova', 'Registrar ocorrência', 'Portaria');
  }
  if (s.gestao) {
    add('/gestao', 'Painel', 'Gestão');
    add('/gestao/ocorrencias', 'Ocorrências e penalidades', 'Gestão');
    add('/gestao/chamados', 'Chamados', 'Gestão');
    add('/gestao/cadastros', 'Cadastros a validar', 'Gestão');
    add('/gestao/contas', 'Prestação de contas', 'Gestão');
    add('/gestao/reservas', 'Reservas', 'Gestão');
    add('/gestao/unidades', 'Unidades e convites', 'Gestão');
    add('/gestao/pessoas', 'Pessoas e papéis', 'Gestão');
    add('/gestao/configuracoes', 'Configurações', 'Gestão');
  } else if (s.blocosSubsindico.length > 0) {
    add('/gestao/chamados', 'Chamados do bloco', 'Subsíndico');
    add('/gestao/cadastros', 'Cadastros do bloco', 'Subsíndico');
  }
  if (s.conselho) {
    add('/conselho', 'Recursos e pareceres', 'Conselho');
    add('/contas', 'Prestação de contas', 'Conselho');
  }
  if (s.papeis.includes('portaria') && !s.gestao) add('/chamados', 'Chamados', 'Portaria');
  if (semAcesso) add('/vincular', 'Vincular unidade', 'Conta');
  add('/avisos', `Avisos${s.avisosNaoLidos ? ` (${s.avisosNaoLidos})` : ''}`, 'Conta');
  add('/perfil', 'Meu perfil', 'Conta');

  const sub = s.unidades.length
    ? s.unidades.map((u) => u.rotulo).join(' · ')
    : s.gestao ? 'Síndico' : s.papeis.includes('portaria') ? 'Portaria' : s.conselho ? 'Conselho Fiscal' : 'Cadastro em andamento';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b-4 border-ceu bg-marinho px-4 py-2.5 text-white md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
            <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-extrabold">Parque Bello Solare</span>
            <span className="text-xs text-slate-300">{s.nome} · {sub}</span>
          </span>
        </Link>
        <Link href="/avisos" aria-label={`Avisos: ${s.avisosNaoLidos} não lidos`}
          className="relative ml-auto flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
          {s.avisosNaoLidos > 0 && (
            <span className="absolute right-1 top-1 min-w-5 rounded-full bg-sol px-1.5 text-center text-xs font-extrabold text-tinta">{s.avisosNaoLidos}</span>
          )}
        </Link>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <Menu itens={itens} />
        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
