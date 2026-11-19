import { redirect } from 'next/navigation';
import { sessao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/server';
import { texto, voltar } from '@/lib/util';
import { Campo, Cartao, Flash, Titulo, btn, btnSec, campo } from '@/components/ui';

async function salvar(f: FormData) {
  'use server';
  const s = await sessao();
  const sb = await supabaseServidor();
  const { error } = await sb.from('perfis').update({ nome: texto(f, 'nome'), telefone: texto(f, 'telefone') || null }).eq('id', s.userId);
  if (error) voltar('/perfil', { erro: error.message });
  voltar('/perfil', { msg: 'Dados salvos.' });
}

async function sair() {
  'use server';
  const sb = await supabaseServidor();
  await sb.auth.signOut();
  redirect('/login');
}

export default async function Perfil({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await sessao();
  return (
    <>
      <Flash sp={sp} />
      <Titulo sub={s.email}>Meu perfil</Titulo>
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao>
          <form action={salvar} className="flex flex-col gap-3">
            <Campo rotulo="Nome"><input name="nome" defaultValue={s.nome} className={campo} required /></Campo>
            <Campo rotulo="Celular"><input name="telefone" defaultValue={s.telefone ?? ''} className={campo} inputMode="tel" /></Campo>
            <p className="text-sm text-cinza-texto">Papéis: {s.papeis.join(', ') || 'nenhum ainda'}. Unidades: {s.unidades.map((u) => u.rotulo).join(', ') || 'nenhuma'}.</p>
            <button className={btn + ' self-start'}>Salvar</button>
          </form>
          <form action={sair} className="mt-4"><button className={btnSec}>Sair do app</button></form>
        </Cartao>
        <Cartao>
          <h2 className="mb-2 text-lg font-extrabold">Seus dados e a LGPD</h2>
          <div className="flex flex-col gap-2 text-sm leading-relaxed text-cinza-texto">
            <p>O Condomínio Parque Bello Solare é o controlador dos dados. Eles são usados só para a gestão do condomínio: encomendas, acesso de veículos, manutenção, reservas, notificações e prestação de contas.</p>
            <p>A portaria vê apenas nome, unidade, placa e vaga. Seu telefone fica visível só para a administração, o Conselho, o subsíndico do seu bloco e quem mora na sua unidade. A unidade notificada não vê quem registrou a ocorrência.</p>
            <p>Para corrigir ou excluir seus dados, fale com a administração. Ao sair do condomínio, seu acesso é encerrado e o histórico de notificações é mantido pelo prazo legal.</p>
          </div>
        </Cartao>
      </div>
    </>
  );
}
