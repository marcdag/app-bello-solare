import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

const fuso = 'America/Sao_Paulo';

export const dataBR = (d?: string | null) =>
  d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR', { timeZone: fuso }) : '';

export const dataHoraBR = (d?: string | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export const moeda = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const mesAno = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: fuso });

export const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: fuso });

/** Volta para a página com uma mensagem de sucesso ou erro (mostrada no topo). */
export function voltar(caminho: string, opcao: { msg?: string; erro?: string }): never {
  const q = new URLSearchParams();
  if (opcao.msg) q.set('msg', opcao.msg);
  if (opcao.erro) q.set('erro', opcao.erro);
  redirect(`${caminho}${caminho.includes('?') ? '&' : '?'}${q.toString()}`);
}

export const texto = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Envia uma imagem/arquivo para o bucket privado "fotos" e devolve o caminho. */
export async function enviarArquivo(sb: SupabaseClient, arquivo: FormDataEntryValue | null, pasta: string) {
  if (!arquivo || typeof arquivo === 'string' || arquivo.size === 0) return null;
  if (arquivo.size > 8 * 1024 * 1024) throw new Error('Arquivo maior que 8 MB');
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('fotos').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) throw new Error('Não foi possível enviar o arquivo: ' + error.message);
  return caminho;
}

export async function linkArquivo(sb: SupabaseClient, caminho?: string | null) {
  if (!caminho) return null;
  const { data } = await sb.storage.from('fotos').createSignedUrl(caminho, 60 * 60);
  return data?.signedUrl ?? null;
}

export const rotuloStatus: Record<string, string> = {
  em_analise: 'Em análise', notificada: 'Notificação emitida', multada: 'Multa aplicada', arquivada: 'Arquivada',
  em_recurso: 'Em recurso', mantida: 'Mantida pelo Conselho', cancelada: 'Cancelada pelo Conselho',
  pendente: 'Aguardando validação', aprovado: 'Aprovado', recusado: 'Correção pedida',
  rascunho: 'Rascunho', publicada: 'Em análise pelo Conselho', aprovada: 'Aprovada pelo Conselho',
  solicitada: 'Solicitada', confirmada: 'Confirmada',
};

export const rotuloTipo: Record<string, string> = { proprietario: 'Proprietário(a)', morador: 'Morador(a)', inquilino: 'Inquilino(a)' };

export const corStatus = (s: string) => {
  if (['Aberto', 'multada', 'recusado', 'mantida'].includes(s)) return 'bg-red-50 text-red-800';
  if (['Em análise', 'em_analise', 'pendente', 'publicada', 'solicitada', 'Na portaria'].includes(s)) return 'bg-amber-50 text-amber-900';
  if (['Em execução', 'notificada', 'em_recurso'].includes(s)) return 'bg-blue-50 text-blue-900';
  if (['Concluído', 'aprovado', 'aprovada', 'cancelada', 'confirmada'].includes(s)) return 'bg-green-50 text-green-800';
  return 'bg-slate-100 text-slate-700';
};
