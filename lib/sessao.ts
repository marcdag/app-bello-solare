import { redirect } from 'next/navigation';
import { cache } from 'react';
import { supabaseServidor } from './supabase/server';

export type Papel = 'morador' | 'portaria' | 'subsindico' | 'sindico' | 'conselho' | 'admin';
export type UnidadeVinculada = { vinculo_id: string; unidade_id: string; rotulo: string; bloco: string; numero: string; tipo: string };

export type Sessao = {
  userId: string;
  email: string;
  nome: string;
  telefone: string | null;
  papeis: Papel[];
  unidades: UnidadeVinculada[];
  pendentes: UnidadeVinculada[];
  blocosSubsindico: string[];
  gestao: boolean;
  equipe: boolean;
  conselho: boolean;
  avisosNaoLidos: number;
};

export const sessao = cache(async (): Promise<Sessao> => {
  const sb = await supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: perfil }, { data: vinculos }, { count }, { data: blocos }] = await Promise.all([
    sb.from('perfis').select('nome, telefone, papeis').eq('id', user.id).single(),
    sb.from('vinculos').select('id, tipo, status, unidade_id, unidades(bloco_id, numero)').eq('perfil_id', user.id),
    sb.from('avisos').select('id', { count: 'exact', head: true }).eq('perfil_id', user.id).eq('lido', false),
    sb.from('blocos').select('id').eq('subsindico_id', user.id),
  ]);

  const mapa = (v: any): UnidadeVinculada => ({
    vinculo_id: v.id,
    unidade_id: v.unidade_id,
    bloco: v.unidades?.bloco_id,
    numero: v.unidades?.numero,
    rotulo: `Bloco ${v.unidades?.bloco_id} · ${v.unidades?.numero}`,
    tipo: v.tipo,
  });
  const papeis = (perfil?.papeis ?? []) as Papel[];
  return {
    userId: user.id,
    email: user.email ?? '',
    nome: perfil?.nome || user.email || '',
    telefone: perfil?.telefone ?? null,
    papeis,
    unidades: (vinculos ?? []).filter((v) => v.status === 'aprovado').map(mapa),
    pendentes: (vinculos ?? []).filter((v) => v.status === 'pendente').map(mapa),
    blocosSubsindico: (blocos ?? []).map((b) => b.id),
    gestao: papeis.includes('sindico') || papeis.includes('admin'),
    equipe: papeis.some((p) => ['portaria', 'sindico', 'admin'].includes(p)),
    conselho: papeis.includes('conselho'),
    avisosNaoLidos: count ?? 0,
  };
});

/** Garante que o usuário tem algum dos papéis; senão volta para o início. */
export async function exigir(...permitidos: (Papel | 'gestao' | 'equipe' | 'membro')[]) {
  const s = await sessao();
  const ok = permitidos.some((p) =>
    p === 'gestao' ? s.gestao : p === 'equipe' ? s.equipe : p === 'membro' ? s.unidades.length > 0 : s.papeis.includes(p as Papel),
  );
  if (!ok) redirect('/?erro=' + encodeURIComponent('Você não tem acesso a essa área.'));
  return s;
}
