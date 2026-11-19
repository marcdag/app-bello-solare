// Roda as consultas reais das telas contra um PostgREST local (mesmo motor de API do Supabase),
// com o token de cada perfil, para conferir permissões por coluna e relacionamentos.
// Uso: PGRST_URL=http://localhost:3901 JWT_SECRET=... USERS_JSON='{"ana@t":"uuid",...}' node 02_consultas_api.mjs
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const URL_API = process.env.PGRST_URL;
const SEGREDO = process.env.JWT_SECRET;
const USERS = JSON.parse(process.env.USERS_JSON);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub) {
  const corpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${corpo}.${crypto.createHmac('sha256', SEGREDO).update(corpo).digest('base64url')}`;
}
function cliente(email) {
  return createClient('http://local', 'anon', {
    global: {
      headers: { Authorization: `Bearer ${jwt(USERS[email])}` },
      fetch: (u, o) => fetch(String(u).replace('http://local/rest/v1', URL_API), o),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let falhas = 0;
async function caso(nome, fn) {
  try { await fn(); console.log('ok:', nome); } catch (e) { falhas++; console.log('FALHOU:', nome, '-', e.message); }
}
const semErro = (r) => { if (r.error) throw new Error(r.error.message); return r.data ?? r; };

const ana = cliente('ana@t'), beto = cliente('beto@t'), sind = cliente('sindico@t'), port = cliente('portaria@t'), cons = cliente('conselho@t');
const anaId = USERS['ana@t'];

await caso('sessão: perfil, vínculos com unidade, avisos, blocos', async () => {
  semErro(await ana.from('perfis').select('nome, telefone, papeis').eq('id', anaId).single());
  const v = semErro(await ana.from('vinculos').select('id, tipo, status, unidade_id, unidades(bloco_id, numero)').eq('perfil_id', anaId));
  if (v[0]?.unidades?.numero !== '204') throw new Error('embed de unidade falhou');
  semErro(await ana.from('avisos').select('id', { count: 'exact', head: true }).eq('perfil_id', anaId).eq('lido', false));
  semErro(await ana.from('blocos').select('id').eq('subsindico_id', anaId));
});
await caso('início do morador', async () => {
  const ids = [(await ana.from('vinculos').select('unidade_id').eq('perfil_id', anaId)).data[0].unidade_id];
  semErro(await ana.rpc('minhas_encomendas'));
  semErro(await ana.from('chamados').select('id', { count: 'exact', head: true }).eq('aberto_por', anaId).not('status', 'in', '("Concluído","Recusado")'));
  semErro(await ana.from('ocorrencias').select('id, status, ciencia_em').in('unidade_id', ids).in('status', ['notificada', 'multada']));
  semErro(await ana.from('unidades').select('id, cadastro_revisado_em').in('id', ids));
  semErro(await ana.from('contas_mensais').select('id, competencia, status').neq('status', 'rascunho').order('competencia', { ascending: false }).limit(1));
});
await caso('minha unidade: vagas, pessoas, veículos, pets, vínculos com nome', async () => {
  const u = (await ana.from('vinculos').select('unidade_id').eq('perfil_id', anaId)).data[0].unidade_id;
  semErro(await ana.from('unidades').select('cadastro_revisado_em').eq('id', u).single());
  const vagas = semErro(await ana.from('vagas').select('numero, posicao').eq('unidade_id', u).order('numero'));
  if (vagas.map((v) => v.numero).join() !== '335') throw new Error('vaga do C·204 deveria ser 335, veio ' + vagas.map((v) => v.numero));
  semErro(await ana.from('pessoas').select('*').eq('unidade_id', u));
  semErro(await ana.from('veiculos').select('*').eq('unidade_id', u));
  semErro(await ana.from('pets').select('*').eq('unidade_id', u));
  const vin = semErro(await ana.from('vinculos').select('id, tipo, status, perfis!vinculos_perfil_id_fkey(nome)').eq('unidade_id', u).eq('status', 'aprovado'));
  if (!vin[0]?.perfis?.nome) throw new Error('nome do vinculado não veio');
  semErro(await ana.from('unidades').update({ cadastro_revisado_em: '2026-11-19' }).eq('id', u));
  const p = semErro(await ana.from('pessoas').insert({ unidade_id: u, nome: 'Marta', relacao: 'contato_emergencia' }).select('id'));
  semErro(await ana.from('pessoas').delete().eq('id', p[0].id));
});
await caso('morador não altera código de convite nem vê o de ninguém', async () => {
  const r = await ana.from('unidades').select('codigo_convite').limit(1);
  if (!r.error) throw new Error('deveria negar codigo_convite');
  const u = await ana.from('unidades').update({ codigo_convite: 'AAAAAAAA' }).eq('bloco_id', 'C');
  if (!u.error) throw new Error('deveria negar update de codigo_convite');
});
await caso('chamados: listar e abrir', async () => {
  semErro(await ana.from('chamados').select('*').order('criado_em', { ascending: false }).limit(200));
  semErro(await ana.from('chamados').insert({ aberto_por: anaId, bloco_id: 'C', local: 'Garagem', categoria: 'Hidráulica', titulo: 'Vazamento' }));
});
await caso('reservas e espaços', async () => {
  semErro(await ana.from('espacos').select('*').eq('ativo', true).order('nome'));
  semErro(await ana.from('reservas').select('*, espacos(nome)').neq('status', 'cancelada').order('data').limit(200));
});
await caso('contas: lista, detalhe, documentos, dúvidas', async () => {
  const c = semErro(await ana.from('contas_mensais').select('id, competencia, status, publicada_em').neq('status', 'rascunho'));
  const id = c[0].id;
  semErro(await ana.from('contas_mensais').select('*').eq('id', id).single());
  semErro(await ana.from('contas_lancamentos').select('tipo, categoria, valor').eq('conta_id', id));
  semErro(await ana.from('contas_documentos').select('*').eq('conta_id', id));
  semErro(await ana.from('contas_duvidas').select('id, pergunta, resposta, criada_em, respondida_em').eq('conta_id', id).order('criada_em'));
});
await caso('notificações da unidade com enquadramento', async () => {
  const u = (await ana.from('vinculos').select('unidade_id').eq('perfil_id', anaId)).data[0].unidade_id;
  const o = semErro(await ana.from('ocorrencias').select('*, enquadramentos(titulo, base_legal)').in('unidade_id', [u]).order('decidida_em', { ascending: false }));
  if (!o.length || !o[0].enquadramentos) throw new Error('sem ocorrências/enquadramento');
});
await caso('avisos: listar e marcar como lidos', async () => {
  semErro(await ana.from('avisos').select('*').eq('perfil_id', anaId).order('criado_em', { ascending: false }).limit(100));
  semErro(await ana.from('avisos').update({ lido: true }).eq('perfil_id', anaId).eq('lido', false));
});
await caso('perfil: editar nome e telefone (e não papéis)', async () => {
  semErro(await ana.from('perfis').update({ nome: 'Ana Ribeiro', telefone: '61999990000' }).eq('id', anaId));
  const r = await ana.from('perfis').update({ papeis: ['sindico'] }).eq('id', anaId);
  if (!r.error) throw new Error('deveria negar papeis');
});
await caso('portaria: pendentes com unidade, registrar, consultar placa', async () => {
  const p = semErro(await port.from('encomendas').select('id, descricao, registrada_em, unidades(bloco_id, numero)').is('retirada_em', null).order('registrada_em'));
  const u = semErro(await port.from('unidades').select('id').eq('bloco_id', 'C').eq('numero', '204').maybeSingle());
  semErro(await port.from('encomendas').insert({ unidade_id: u.id, descricao: 'Envelope', registrada_por: USERS['portaria@t'] }));
  const c = semErro(await port.rpc('consulta_portaria', { q: 'RTA2B19' }));
  if (c[0]?.unidade !== 'Bloco C · 204') throw new Error('consulta de placa');
  const r = await port.from('encomendas').select('codigo_retirada');
  if (!r.error) throw new Error('portaria não deveria ler o código');
  if (!Array.isArray(p)) throw new Error('lista');
});
await caso('portaria registra ocorrência; enquadramentos', async () => {
  semErro(await port.from('enquadramentos').select('id, titulo').order('titulo'));
  const u = semErro(await port.from('unidades').select('id').eq('bloco_id', 'J').eq('numero', '410').maybeSingle());
  semErro(await port.from('ocorrencias').insert({ unidade_id: u.id, enquadramento_id: 'sossego', fato: 'Barulho', data_fato: '2026-11-18', registrada_por: USERS['portaria@t'] }));
});
await caso('gestão: painel (contagens, ocorrências com unidade, configuração)', async () => {
  for (const t of ['ocorrencias', 'chamados', 'vinculos', 'pessoas', 'veiculos', 'pets', 'encomendas'])
    semErro(await sind.from(t).select('id', { count: 'exact', head: true }));
  semErro(await sind.from('vinculos').select('unidade_id').eq('status', 'aprovado'));
  semErro(await sind.from('ocorrencias').select('id, fato, status, criada_em, unidades(bloco_id, numero)').order('criada_em', { ascending: false }).limit(6));
  semErro(await sind.from('configuracoes').select('valor').eq('chave', 'menor_taxa_condominial').single());
});
await caso('gestão: ocorrência, sugestão e decisão', async () => {
  const o = semErro(await sind.from('ocorrencias').select('id, fato, status, data_fato, unidades(bloco_id, numero)').eq('status', 'em_analise'));
  const d = semErro(await sind.from('ocorrencias').select('*, unidades(bloco_id, numero), enquadramentos(titulo, base_legal, multa_direta)').eq('id', o[0].id).single());
  const s = semErro(await sind.rpc('sugerir_penalidade', { p_ocorrencia: d.id }));
  if (!s[0]?.penalidade) throw new Error('sem sugestão');
  semErro(await sind.rpc('decidir_ocorrencia', { p_id: d.id, p_enquadramento: null, p_decisao: 'notificacao', p_percentual: 100 }));
});
await caso('gestão: chamados, cadastros com nome/telefone, reservas', async () => {
  const c = semErro(await sind.from('chamados').select('*').not('status', 'in', '("Concluído","Recusado")'));
  const r = await sind.from('chamados').update({ status: 'Em análise', resposta: 'Vamos ver' }, { count: 'exact' }).eq('id', c[0].id);
  if (r.error || r.count !== 1) throw new Error('update de chamado: ' + (r.error?.message ?? r.count));
  semErro(await sind.from('vinculos').select('id, tipo, criado_em, perfis!vinculos_perfil_id_fkey(nome, telefone), unidades(bloco_id, numero)').eq('status', 'pendente'));
  semErro(await sind.from('pessoas').select('*, unidades(bloco_id, numero)').eq('status', 'pendente'));
  semErro(await sind.from('veiculos').select('*, unidades(bloco_id, numero)').eq('status', 'pendente'));
  semErro(await sind.from('reservas').select('*, espacos(nome), unidades(bloco_id, numero)').neq('status', 'cancelada'));
});
await caso('gestão: unidades/convites, vagas, pessoas e papéis, blocos', async () => {
  const c = semErro(await sind.rpc('codigos_convite'));
  if (c.length !== 368) throw new Error('368 códigos');
  const v = semErro(await sind.from('vagas').select('numero, unidade_id'));
  if (v.length !== 406) throw new Error('406 vagas, veio ' + v.length);
  semErro(await sind.from('vinculos').select('unidade_id, tipo, perfis!vinculos_perfil_id_fkey(nome)').eq('status', 'aprovado'));
  semErro(await sind.from('perfis').select('id, nome, telefone, papeis, vinculos!vinculos_perfil_id_fkey(id, status, tipo, unidades(bloco_id, numero))').order('nome').limit(50));
  semErro(await sind.from('perfis').select('id, nome').contains('papeis', ['subsindico']));
  semErro(await sind.from('blocos').update({ subsindico_id: null }).eq('id', 'C'));
  semErro(await sind.rpc('definir_papeis', { p: USERS['beto@t'], novos: ['morador'] }));
});
await caso('gestão: contas (criar, lançar, publicar, responder) e configurações', async () => {
  const n = semErro(await sind.from('contas_mensais').insert({ competencia: '2026-11-01' }).select('id').single());
  semErro(await sind.from('contas_lancamentos').insert({ conta_id: n.id, tipo: 'despesa', categoria: 'Portaria e segurança', valor: 48200 }));
  semErro(await sind.from('contas_mensais').update({ fundo_reserva: 190000, inadimplencia_pct: 7.5, observacoes: null }).eq('id', n.id));
  semErro(await sind.from('contas_mensais').update({ status: 'publicada' }).eq('id', n.id).eq('status', 'rascunho'));
  const d = semErro(await sind.from('contas_duvidas').select('*'));
  semErro(await sind.from('contas_duvidas').update({ resposta: 'Reajuste da tarifa', respondida_em: new Date().toISOString() }).eq('id', d[0].id));
  semErro(await sind.from('configuracoes').update({ valor: '380' }).eq('chave', 'menor_taxa_condominial'));
  semErro(await sind.from('enquadramentos').update({ titulo: 'Sossego e barulho (silêncio das 22h às 7h)' }).eq('id', 'sossego'));
  semErro(await sind.from('espacos').update({ max_convidados: 50 }).eq('id', 'salao'));
});
await caso('conselho: recursos e contas para parecer', async () => {
  semErro(await cons.from('ocorrencias').select('*, unidades(bloco_id, numero), enquadramentos(titulo, base_legal)').eq('status', 'em_recurso'));
  const c = semErro(await cons.from('contas_mensais').select('id, competencia, status').eq('status', 'publicada'));
  semErro(await cons.rpc('registrar_parecer', { p_conta: c[0].id, p_texto: 'Regulares' }));
});
await caso('Beto não vê nada do C·204', async () => {
  const e = semErro(await beto.rpc('minhas_encomendas'));
  const p = semErro(await beto.from('pessoas').select('*'));
  const c204 = semErro(await sind.from('unidades').select('id').eq('bloco_id', 'C').eq('numero', '204').single()).id;
  const o = semErro(await beto.from('ocorrencias').select('*').eq('unidade_id', c204));
  const perfisVisiveis = semErro(await beto.from('perfis').select('id'));
  if (e.length || p.length || o.length || perfisVisiveis.length !== 1) throw new Error(`vazamento entre unidades: encomendas ${e.length}, pessoas ${p.length}, ocorrências ${o.length}, perfis ${perfisVisiveis.length}`);
});

console.log(falhas ? `${falhas} FALHA(S)` : 'TODAS AS CONSULTAS DA API PASSARAM');
process.exit(falhas ? 1 : 0);
