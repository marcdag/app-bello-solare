import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { Aviso, Flash, Kpi, Titulo, btnSec } from '@/components/ui';
import { dataBR } from '@/lib/util';

export default async function Inicio({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await sessao();
  if (s.unidades.length === 0) {
    if (s.gestao) redirect('/gestao');
    if (s.papeis.includes('portaria')) redirect('/portaria');
    if (s.conselho) redirect('/conselho');
    if (s.blocosSubsindico.length) redirect('/gestao/chamados');
    redirect('/vincular');
  }
  const sb = await supabaseServidor();
  const ids = s.unidades.map((u) => u.unidade_id);
  const [{ data: encs }, { count: chamados }, { data: ocs }, { data: unidades }, { data: contas }] = await Promise.all([
    sb.rpc('minhas_encomendas'),
    sb.from('chamados').select('id', { count: 'exact', head: true }).eq('aberto_por', s.userId).not('status', 'in', '("Concluído","Recusado")'),
    sb.from('ocorrencias').select('id, status, ciencia_em').in('unidade_id', ids).in('status', ['notificada', 'multada']),
    sb.from('unidades').select('id, cadastro_revisado_em').in('id', ids),
    sb.from('contas_mensais').select('id, competencia, status').neq('status', 'rascunho').order('competencia', { ascending: false }).limit(1),
  ]);
  const pendentes = (encs ?? []).filter((e: any) => !e.retirada_em).length;
  const semCiencia = (ocs ?? []).filter((o) => !o.ciencia_em).length;
  const revisao = (unidades ?? []).map((u) => u.cadastro_revisado_em).sort()[0];
  const revisaoVencida = !revisao || new Date(revisao) < new Date(Date.now() - 180 * 864e5);

  return (
    <>
      <Flash sp={sp} />
      <Titulo>Olá, {s.nome.split(' ')[0]}</Titulo>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Kpi valor={pendentes} rotulo="Encomendas na portaria" href="/encomendas" />
        <Kpi valor={chamados ?? 0} rotulo="Meus chamados abertos" href="/chamados" />
        <Kpi valor={semCiencia} rotulo="Notificações sem ciência" cor="text-amber-700" href="/notificacoes" />
      </div>
      {semCiencia > 0 && (
        <div className="mt-4"><Aviso tipo="alerta">Você tem notificação sem ciência. Dê ciência e, se discordar, recorra ao Conselho em até 10 dias. <Link className="font-bold underline" href="/notificacoes">Ver agora</Link></Aviso></div>
      )}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Link className={btnSec + ' justify-start'} href="/chamados#novo">Abrir chamado de manutenção</Link>
        <Link className={btnSec + ' justify-start'} href="/reservas">Reservar espaço</Link>
        <Link className={btnSec + ' justify-start'} href="/unidade">Revisar cadastro da unidade</Link>
      </div>
      {contas?.[0] && (
        <div className="mt-4"><Aviso>Prestação de contas de {new Date(contas[0].competencia + 'T12:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} disponível. <Link className="font-bold underline" href={`/contas/${contas[0].id}`}>Ver contas</Link></Aviso></div>
      )}
      {revisaoVencida && (
        <div className="mt-4"><Aviso tipo="alerta">Cadastro desatualizado é infração com multa direta (RI Art. 82). {revisao ? `Última revisão: ${dataBR(revisao)}.` : 'Sua unidade ainda não confirmou o cadastro.'} <Link className="font-bold underline" href="/unidade">Revisar</Link></Aviso></div>
      )}
      {s.pendentes.length > 0 && (
        <div className="mt-4"><Aviso>Aguardando validação: {s.pendentes.map((p) => p.rotulo).join(', ')}.</Aviso></div>
      )}
    </>
  );
}
