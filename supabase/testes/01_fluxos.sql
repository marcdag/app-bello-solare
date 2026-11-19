-- Testes de permissão e fluxos. Rodar depois de 00_simula_supabase.sql e das migrações.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create or replace function pg_temp.como(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = u), false);
  if u is null then perform set_config('request.jwt.claim.sub', '', false); end if;
end $$;
create or replace function pg_temp.espera_erro(q text, trecho text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'FALHOU: deveria dar erro: %', q;
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  if trecho is not null and position(trecho in sqlerrm) = 0 then raise exception 'FALHOU: erro inesperado em %: %', q, sqlerrm; end if;
end $$;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
grant execute on all functions in schema pg_temp to authenticated;
grant select on auth.users to authenticated;  -- só para o helper de teste

insert into auth.users (email, raw_user_meta_data) values
  ('sindico@t', '{"nome":"Síndico Teste"}'), ('portaria@t', '{"nome":"Porteiro"}'),
  ('ana@t', '{"nome":"Ana C204"}'), ('beto@t', '{"nome":"Beto F308"}'), ('conselho@t', '{"nome":"Conselheira"}');
update perfis set papeis = '{sindico}'  where id = (select id from auth.users where email = 'sindico@t');
update perfis set papeis = '{portaria}' where id = (select id from auth.users where email = 'portaria@t');
update perfis set papeis = '{conselho}' where id = (select id from auth.users where email = 'conselho@t');

select set_config('t.c204', (select codigo_convite from unidades where bloco_id = 'C' and numero = '204'), false);
select set_config('t.f308', (select codigo_convite from unidades where bloco_id = 'F' and numero = '308'), false);
select set_config('t.u204', (select id::text from unidades where bloco_id = 'C' and numero = '204'), false);
select set_config('t.u308', (select id::text from unidades where bloco_id = 'F' and numero = '308'), false);

set role authenticated;

-- 1. Convite e validação
select pg_temp.como('ana@t');
select pg_temp.espera_erro($$select codigo_convite from unidades limit 1$$, 'permission denied');
select pg_temp.espera_erro($$select * from codigos_convite()$$, 'Apenas a gestão');
select pg_temp.espera_erro($$select solicitar_vinculo('XXXXXXXX', 'proprietario')$$, 'não encontrado');
select pg_temp.ok(solicitar_vinculo(current_setting('t.c204'), 'proprietario') = 'Bloco C · 204', 'Ana pede vínculo ao C·204');
select pg_temp.espera_erro($$update perfis set papeis = '{sindico}' where id = auth.uid()$$, 'permission denied');
select pg_temp.ok((select count(*) from minhas_encomendas()) = 0, 'Ana pendente não vê nada da unidade');
select pg_temp.como('beto@t');
select solicitar_vinculo(current_setting('t.f308'), 'inquilino');
select pg_temp.como('sindico@t');
select pg_temp.ok((select count(*) from codigos_convite()) = 368, 'síndico vê os 368 códigos');
select validar_vinculo(id, true) from vinculos where status = 'pendente';
select pg_temp.como('ana@t');
select pg_temp.ok((select 'morador' = any(papeis) from perfis where id = auth.uid()), 'Ana virou moradora');
select pg_temp.ok((select count(*) from avisos where titulo = 'Cadastro aprovado') = 1, 'Ana recebeu aviso de aprovação');

-- 2. Cadastro da unidade
insert into veiculos (unidade_id, placa, modelo, vaga_numero) values (current_setting('t.u204')::uuid, 'RTA2B19', 'Honda Fit', 335);
insert into pets (unidade_id, nome, especie, porte, status) values (current_setting('t.u204')::uuid, 'Mel', 'cão', 'pequeno', 'aprovado');
select pg_temp.ok((select status from pets where nome = 'Mel') = 'pendente', 'morador não autoaprova pet');
select pg_temp.como('beto@t');
select pg_temp.ok((select count(*) from veiculos) = 0, 'Beto não vê veículo do C·204');
select pg_temp.espera_erro($$insert into pets (unidade_id, nome, especie) values (current_setting('t.u204')::uuid, 'X', 'gato')$$, 'row-level security');
select pg_temp.como('portaria@t');
select pg_temp.ok((select count(*) from consulta_portaria('RTA')) = 0, 'portaria não vê veículo ainda não aprovado');
select pg_temp.como('sindico@t');
update veiculos set status = 'aprovado';
select pg_temp.como('portaria@t');
select pg_temp.ok((select unidade from consulta_portaria('rta 2b19')) = 'Bloco C · 204', 'portaria acha placa');
select pg_temp.ok((select count(*) from consulta_portaria('C204')) = 1, 'portaria acha por unidade');

-- 3. Encomendas
insert into encomendas (unidade_id, descricao) values (current_setting('t.u204')::uuid, 'Caixa Mercado Livre');
select pg_temp.espera_erro($$select codigo_retirada from encomendas$$, 'permission denied');
select pg_temp.como('beto@t');
select pg_temp.ok((select count(*) from encomendas) = 0 and (select count(*) from minhas_encomendas()) = 0, 'Beto não vê encomenda do C·204');
select pg_temp.como('ana@t');
select pg_temp.ok((select count(*) from minhas_encomendas() where retirada_em is null) = 1, 'Ana vê encomenda com código');
select pg_temp.ok((select count(*) from avisos where titulo = 'Encomenda na portaria') = 1, 'Ana avisada da encomenda');
select set_config('t.cod', (select codigo_retirada from minhas_encomendas() limit 1), false);
select pg_temp.espera_erro($$select entregar_encomenda((select id from encomendas limit 1), current_setting('t.cod'), 'Ana')$$, 'Apenas portaria');
select pg_temp.como('portaria@t');
select pg_temp.espera_erro($$select entregar_encomenda((select id from encomendas limit 1), 'zzzz', 'Ana')$$, 'incorreto');
select entregar_encomenda((select id from encomendas limit 1), current_setting('t.cod'), 'Ana');
select pg_temp.ok((select retirada_em is not null from encomendas limit 1), 'entrega registrada com código certo');

-- 4. Chamados
select pg_temp.como('ana@t');
insert into chamados (aberto_por, unidade_id, bloco_id, local, categoria, titulo) values (auth.uid(), current_setting('t.u204')::uuid, 'C', 'Hall 3º andar', 'Elétrica', 'Lâmpada queimada');
select pg_temp.espera_erro($$insert into chamados (aberto_por, local, categoria, titulo) values ((select id from perfis where nome = 'Porteiro'), 'x', 'Outros', 'falso')$$, 'row-level security');
update chamados set status = 'Concluído';  -- sem efeito: não é gestão
select pg_temp.ok((select status from chamados) = 'Aberto', 'morador não muda status');
select pg_temp.como('sindico@t');
update chamados set status = 'Em execução';
select pg_temp.como('ana@t');
select pg_temp.ok((select count(*) from avisos where titulo = 'Chamado: Em execução') = 1, 'Ana avisada do status');

-- 5. Ocorrências e penalidades (RI Art. 82)
select pg_temp.como('portaria@t');
insert into ocorrencias (unidade_id, enquadramento_id, fato, registrada_por) values (current_setting('t.u204')::uuid, 'sossego', 'Som alto 23h40', auth.uid());
select pg_temp.como('ana@t');
select pg_temp.ok((select count(*) from ocorrencias) = 0, 'unidade não vê ocorrência em análise');
select pg_temp.como('sindico@t');
select pg_temp.ok((select penalidade || '/' || percentual from sugerir_penalidade((select id from ocorrencias limit 1))) = 'multa/100', 'sossego: multa direta 100%');
select decidir_ocorrencia((select id from ocorrencias limit 1), null, 'multa', 100);
insert into ocorrencias (unidade_id, enquadramento_id, fato, registrada_por) values (current_setting('t.u204')::uuid, 'pets', 'Cão solto', auth.uid());
select pg_temp.ok((select penalidade || '/' || percentual from sugerir_penalidade((select id from ocorrencias where status = 'em_analise'))) = 'multa/100', 'reincidência: multa 100%');
select decidir_ocorrencia((select id from ocorrencias where status = 'em_analise'), null, 'multa', 100);
insert into ocorrencias (unidade_id, enquadramento_id, fato, registrada_por) values (current_setting('t.u204')::uuid, 'fachada', 'Roupa na janela', auth.uid());
select pg_temp.ok((select percentual from sugerir_penalidade((select id from ocorrencias where status = 'em_analise'))) = 200, '2ª reincidência: multa em dobro 200%');
insert into ocorrencias (unidade_id, enquadramento_id, fato, registrada_por) values (current_setting('t.u308')::uuid, 'fachada', 'Roupa na janela', auth.uid());
select pg_temp.ok((select penalidade from sugerir_penalidade((select id from ocorrencias where unidade_id = current_setting('t.u308')::uuid))) = 'notificacao', '1ª infração comum: notificação');
select pg_temp.como('ana@t');
select pg_temp.ok((select count(*) from ocorrencias) = 2, 'Ana vê as 2 penalidades decididas, não a em análise');
select pg_temp.espera_erro($$update ocorrencias set status = 'cancelada'$$, 'permission denied');
select recorrer((select id from ocorrencias where enquadramento_id = 'sossego'), 'Era o vizinho de cima');
select pg_temp.espera_erro($$select julgar_recurso((select id from ocorrencias where enquadramento_id = 'sossego'), false, 'x')$$, 'Apenas o Conselho');
select pg_temp.como('conselho@t');
select pg_temp.ok((select count(*) from avisos where titulo = 'Recurso para julgar') = 1, 'Conselho avisado do recurso');
select julgar_recurso((select id from ocorrencias where enquadramento_id = 'sossego'), false, 'Prova insuficiente');
select pg_temp.ok((select status from ocorrencias where enquadramento_id = 'sossego') = 'cancelada', 'Conselho cancelou');

-- 6. Reservas
select pg_temp.como('ana@t');
select solicitar_reserva('salao', current_setting('t.u204')::uuid, current_date + 5, 30);
select pg_temp.espera_erro($$select solicitar_reserva('salao', current_setting('t.u204')::uuid, current_date + 5, 10)$$, 'já está reservada');
select pg_temp.espera_erro($$select solicitar_reserva('gourmet', current_setting('t.u204')::uuid, current_date + 5, 40)$$, 'Limite de 32');
select pg_temp.espera_erro($$select solicitar_reserva('gourmet', current_setting('t.u204')::uuid, current_date, 10)$$, 'antecedência');
select pg_temp.como('beto@t');
select pg_temp.espera_erro($$select solicitar_reserva('gourmet', current_setting('t.u204')::uuid, current_date + 6, 10)$$, 'não está vinculado');

-- 7. Prestação de contas
select pg_temp.como('sindico@t');
insert into contas_mensais (competencia, fundo_reserva, inadimplencia_pct) values ('2026-10-01', 186420, 8);
insert into contas_lancamentos (conta_id, tipo, categoria, valor) select id, 'receita', 'Taxas condominiais', 128650 from contas_mensais;
select pg_temp.como('ana@t');
select pg_temp.ok((select count(*) from contas_mensais) = 0 and (select count(*) from contas_lancamentos) = 0, 'rascunho invisível ao morador');
select pg_temp.espera_erro($$insert into contas_mensais (competencia) values ('2026-11-01')$$, 'row-level security');
select pg_temp.como('sindico@t');
update contas_mensais set status = 'publicada';
select pg_temp.como('ana@t');
select pg_temp.ok((select count(*) from contas_lancamentos) = 1, 'publicada: morador vê lançamentos');
select pg_temp.ok((select count(*) from avisos where titulo = 'Prestação de contas publicada') = 1, 'morador avisado da publicação');
insert into contas_duvidas (conta_id, perfil_id, pergunta) select id, auth.uid(), 'Por que subiu a energia?' from contas_mensais;
select pg_temp.como('conselho@t');
select registrar_parecer((select id from contas_mensais), 'Contas regulares');
select pg_temp.ok((select status from contas_mensais) = 'aprovada', 'parecer do Conselho registrado');

-- 8. Auditoria
reset role;
select pg_temp.ok((select count(*) from auditoria where tabela = 'ocorrencias') >= 5, 'auditoria registrou ocorrências');
select pg_temp.ok((select count(*) from auditoria where tabela = 'encomendas' and acao = 'UPDATE') = 1, 'auditoria registrou entrega');
\echo TODOS OS TESTES PASSARAM
