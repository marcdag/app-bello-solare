-- =====================================================================
-- Segurança (Row Level Security), funções de negócio e avisos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares de permissão
-- ---------------------------------------------------------------------
create or replace function public.tem_papel(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and p = any(papeis));
$$;

create or replace function public.e_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papeis && array['sindico','admin']);
$$;

create or replace function public.e_equipe() returns boolean   -- portaria ou gestão
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papeis && array['portaria','sindico','admin']);
$$;

create or replace function public.minhas_unidades() returns setof uuid
language sql stable security definer set search_path = public as $$
  select unidade_id from public.vinculos where perfil_id = auth.uid() and status = 'aprovado';
$$;

create or replace function public.e_membro(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vinculos where perfil_id = auth.uid() and unidade_id = u and status = 'aprovado');
$$;

create or replace function public.e_subsindico_do_bloco(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocos where id = b and subsindico_id = auth.uid());
$$;

create or replace function public.rotulo_unidade(u uuid) returns text
language sql stable security definer set search_path = public as $$
  select 'Bloco ' || bloco_id || ' · ' || numero from public.unidades where id = u;
$$;

-- ---------------------------------------------------------------------
-- Conta nova → perfil
-- ---------------------------------------------------------------------
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, telefone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''), new.raw_user_meta_data ->> 'telefone')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------
-- Avisos (sino do app)
-- ---------------------------------------------------------------------
create or replace function public.avisar_unidade(u uuid, t text, c text, l text) returns void
language sql security definer set search_path = public as $$
  insert into public.avisos (perfil_id, titulo, corpo, link)
  select perfil_id, t, c, l from public.vinculos where unidade_id = u and status = 'aprovado';
$$;

create or replace function public.avisar_papel(p text, t text, c text, l text) returns void
language sql security definer set search_path = public as $$
  insert into public.avisos (perfil_id, titulo, corpo, link)
  select id, t, c, l from public.perfis where p = any(papeis);
$$;

-- ---------------------------------------------------------------------
-- Ativar RLS em todas as tabelas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['blocos','unidades','vagas','perfis','vinculos','pessoas','veiculos','pets','encomendas',
                           'chamados','enquadramentos','ocorrencias','espacos','reservas','contas_mensais',
                           'contas_lancamentos','contas_documentos','contas_duvidas','avisos','configuracoes','auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Estrutura: leitura para quem está logado
create policy leitura on public.blocos   for select to authenticated using (true);
create policy gestao   on public.blocos   for update to authenticated using (public.e_gestao());
create policy leitura on public.vagas    for select to authenticated using (true);
create policy leitura on public.enquadramentos for select to authenticated using (true);
create policy gestao   on public.enquadramentos for all to authenticated using (public.e_gestao()) with check (public.e_gestao());
create policy leitura on public.espacos  for select to authenticated using (true);
create policy gestao   on public.espacos  for all to authenticated using (public.e_gestao()) with check (public.e_gestao());
create policy leitura on public.configuracoes for select to authenticated using (true);
create policy gestao   on public.configuracoes for all to authenticated using (public.e_gestao()) with check (public.e_gestao());

-- Unidades: todos veem bloco/número; o código de convite só a gestão
create policy leitura on public.unidades for select to authenticated using (true);
create policy gestao  on public.unidades for update to authenticated using (public.e_gestao() or public.e_membro(id));
revoke select on public.unidades from authenticated;
grant select (id, bloco_id, numero, andar, fracao_ideal, cadastro_revisado_em) on public.unidades to authenticated;
revoke update on public.unidades from authenticated;
grant update (cadastro_revisado_em) on public.unidades to authenticated;

create or replace function public.codigos_convite()
returns table (unidade_id uuid, bloco text, numero text, codigo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.e_gestao() then raise exception 'Apenas a gestão pode ver os códigos de convite'; end if;
  return query select u.id, u.bloco_id, u.numero, u.codigo_convite from public.unidades u order by u.bloco_id, u.numero;
end $$;

create or replace function public.novo_codigo_convite(u uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.e_gestao() then raise exception 'Apenas a gestão'; end if;
  update public.unidades set codigo_convite = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
   where id = u returning codigo_convite into c;
  return c;
end $$;

-- Perfis: cada um vê e edita o próprio nome/telefone; gestão e conselho veem todos
create policy proprio  on public.perfis for select to authenticated
  using (id = auth.uid() or public.e_gestao() or public.tem_papel('conselho')
         or exists (select 1 from public.vinculos v where v.perfil_id = perfis.id and v.unidade_id in (select public.minhas_unidades()))
         or exists (select 1 from public.vinculos v join public.unidades u on u.id = v.unidade_id
                     where v.perfil_id = perfis.id and public.e_subsindico_do_bloco(u.bloco_id)));
create policy editar   on public.perfis for update to authenticated using (id = auth.uid() or public.e_gestao());
revoke update on public.perfis from authenticated;
grant update (nome, telefone) on public.perfis to authenticated;

create or replace function public.definir_papeis(p uuid, novos text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_gestao() then raise exception 'Apenas a gestão pode alterar papéis'; end if;
  if 'admin' = any(novos) and not public.tem_papel('admin') then raise exception 'Apenas um admin concede admin'; end if;
  update public.perfis set papeis = novos where id = p;
end $$;

-- Vínculos: criados pelo código de convite, aprovados pela gestão ou subsíndico do bloco
create policy leitura on public.vinculos for select to authenticated
  using (perfil_id = auth.uid() or public.e_gestao() or unidade_id in (select public.minhas_unidades())
         or public.e_subsindico_do_bloco((select bloco_id from public.unidades where id = unidade_id)));
revoke insert, update, delete on public.vinculos from authenticated;

create or replace function public.solicitar_vinculo(p_codigo text, p_tipo text) returns text
language plpgsql security definer set search_path = public as $$
declare u public.unidades;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  if p_tipo not in ('proprietario','morador','inquilino') then raise exception 'Tipo inválido'; end if;
  select * into u from public.unidades where codigo_convite = upper(trim(p_codigo));
  if not found then raise exception 'Código de convite não encontrado. Confira com a administração.'; end if;
  insert into public.vinculos (perfil_id, unidade_id, tipo) values (auth.uid(), u.id, p_tipo)
    on conflict (perfil_id, unidade_id) do update set tipo = excluded.tipo, status = 'pendente';
  perform public.avisar_papel('sindico', 'Novo cadastro para validar',
          'Pedido de vínculo para Bloco ' || u.bloco_id || ' · ' || u.numero, '/gestao/cadastros');
  return 'Bloco ' || u.bloco_id || ' · ' || u.numero;
end $$;

create or replace function public.validar_vinculo(p_id uuid, p_aprovar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.vinculos; b text;
begin
  select * into v from public.vinculos where id = p_id;
  select bloco_id into b from public.unidades where id = v.unidade_id;
  if not (public.e_gestao() or public.e_subsindico_do_bloco(b)) then raise exception 'Sem permissão'; end if;
  update public.vinculos set status = case when p_aprovar then 'aprovado' else 'recusado' end,
         validado_por = auth.uid(), validado_em = now() where id = p_id;
  if p_aprovar then
    update public.perfis set papeis = array(select distinct unnest(papeis || array['morador'])) where id = v.perfil_id;
  end if;
  insert into public.avisos (perfil_id, titulo, corpo, link)
  values (v.perfil_id, case when p_aprovar then 'Cadastro aprovado' else 'Cadastro não aprovado' end,
          case when p_aprovar then 'Seu acesso à unidade ' || public.rotulo_unidade(v.unidade_id) || ' foi liberado.'
               else 'Procure a administração para conferir seus dados.' end, '/');
end $$;

create or replace function public.encerrar_vinculo(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_gestao() then raise exception 'Sem permissão'; end if;
  update public.vinculos set status = 'encerrado', validado_por = auth.uid(), validado_em = now() where id = p_id;
end $$;

-- Pessoas, veículos e pets: a unidade cadastra; gestão valida; portaria consulta veículos
create policy unidade on public.pessoas for all to authenticated
  using (public.e_membro(unidade_id) or public.e_gestao())
  with check (public.e_membro(unidade_id) or public.e_gestao());
create policy unidade on public.pets for all to authenticated
  using (public.e_membro(unidade_id) or public.e_gestao())
  with check (public.e_membro(unidade_id) or public.e_gestao());
create policy unidade on public.veiculos for all to authenticated
  using (public.e_membro(unidade_id) or public.e_gestao())
  with check (public.e_membro(unidade_id) or public.e_gestao());
create policy portaria on public.veiculos for select to authenticated using (public.tem_papel('portaria'));

-- status só muda pela gestão
create or replace function public.proteger_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_gestao() then
    if tg_op = 'INSERT' then new.status := 'pendente'; new.criado_por := auth.uid();
    elsif new.status is distinct from old.status then new.status := 'pendente';
    elsif row(new.*) is distinct from row(old.*) then new.status := 'pendente';  -- alteração volta para validação
    end if;
  end if;
  return new;
end $$;
create trigger status_pessoas  before insert or update on public.pessoas  for each row execute function public.proteger_status();
create trigger status_veiculos before insert or update on public.veiculos for each row execute function public.proteger_status();
create trigger status_pets     before insert or update on public.pets     for each row execute function public.proteger_status();

-- Consulta da portaria (LGPD: sem telefone nem documento)
create or replace function public.consulta_portaria(q text)
returns table (placa text, modelo text, cor text, vaga int, adesivo text, unidade text, responsavel text)
language plpgsql stable security definer set search_path = public as $$
declare n text := upper(regexp_replace(coalesce(q, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not public.e_equipe() then raise exception 'Apenas portaria e gestão'; end if;
  n := regexp_replace(n, '^BLOCO', '');
  return query
    select v.placa, v.modelo, v.cor, v.vaga_numero, v.adesivo, 'Bloco ' || u.bloco_id || ' · ' || u.numero,
           (select p.nome from public.vinculos vi join public.perfis p on p.id = vi.perfil_id
             where vi.unidade_id = u.id and vi.status = 'aprovado' order by vi.criado_em limit 1)
      from public.veiculos v join public.unidades u on u.id = v.unidade_id
     where v.status = 'aprovado' and (n = '' or v.placa like '%' || n || '%' or (u.bloco_id || u.numero) like '%' || n || '%')
     order by u.bloco_id, u.numero limit 50;
end $$;

-- Encomendas: o código de retirada só aparece para quem mora na unidade
create policy leitura on public.encomendas for select to authenticated
  using (public.e_membro(unidade_id) or public.e_equipe());
create policy registrar on public.encomendas for insert to authenticated with check (public.e_equipe());
revoke select, update, delete on public.encomendas from authenticated;
grant select (id, unidade_id, descricao, foto_path, registrada_por, registrada_em, retirada_em, retirada_por_nome, entregue_por)
  on public.encomendas to authenticated;

create or replace function public.minhas_encomendas()
returns table (id uuid, unidade text, descricao text, foto_path text, codigo_retirada text,
               registrada_em timestamptz, retirada_em timestamptz, retirada_por_nome text)
language sql stable security definer set search_path = public as $$
  select e.id, public.rotulo_unidade(e.unidade_id), e.descricao, e.foto_path, e.codigo_retirada,
         e.registrada_em, e.retirada_em, e.retirada_por_nome
    from public.encomendas e
   where e.unidade_id in (select public.minhas_unidades())
   order by (e.retirada_em is null) desc, e.registrada_em desc
   limit 100;
$$;

create or replace function public.entregar_encomenda(p_id uuid, p_codigo text, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
declare e public.encomendas;
begin
  if not public.e_equipe() then raise exception 'Apenas portaria e gestão'; end if;
  select * into e from public.encomendas where id = p_id for update;
  if e.retirada_em is not null then raise exception 'Encomenda já entregue'; end if;
  if e.codigo_retirada <> trim(p_codigo) then raise exception 'Código de retirada incorreto'; end if;
  update public.encomendas set retirada_em = now(), retirada_por_nome = nullif(trim(p_nome), ''), entregue_por = auth.uid()
   where id = p_id;
end $$;

create or replace function public.aviso_encomenda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_unidade(new.unidade_id, 'Encomenda na portaria',
          new.descricao || '. Código de retirada: ' || new.codigo_retirada, '/encomendas');
  return new;
end $$;
create trigger aviso_encomenda after insert on public.encomendas for each row execute function public.aviso_encomenda();

-- Chamados: todos veem (evita duplicados); quem abriu é avisado; gestão/subsíndico atualizam
create policy leitura on public.chamados for select to authenticated using (true);
create policy abrir on public.chamados for insert to authenticated with check (aberto_por = auth.uid());
create policy atualizar on public.chamados for update to authenticated
  using (public.e_gestao() or public.e_subsindico_do_bloco(bloco_id));

create or replace function public.chamado_atualizado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  if new.status is distinct from old.status then
    insert into public.avisos (perfil_id, titulo, corpo, link)
    values (new.aberto_por, 'Chamado: ' || new.status, new.titulo, '/chamados');
  end if;
  return new;
end $$;
create trigger chamado_atualizado before update on public.chamados for each row execute function public.chamado_atualizado();

create or replace function public.chamado_aberto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_papel('sindico', 'Novo chamado: ' || new.categoria, new.titulo || ' — ' || new.local, '/gestao/chamados');
  if new.bloco_id is not null then
    insert into public.avisos (perfil_id, titulo, corpo, link)
    select subsindico_id, 'Novo chamado no Bloco ' || id, new.titulo, '/gestao/chamados'
      from public.blocos where id = new.bloco_id and subsindico_id is not null;
  end if;
  return new;
end $$;
create trigger chamado_aberto after insert on public.chamados for each row execute function public.chamado_aberto();

-- Ocorrências
create policy leitura on public.ocorrencias for select to authenticated
  using (public.e_gestao() or public.tem_papel('conselho') or registrada_por = auth.uid()
         or (public.e_membro(unidade_id) and status <> 'em_analise'));
create policy registrar on public.ocorrencias for insert to authenticated
  with check (registrada_por = auth.uid() and status = 'em_analise');
revoke update, delete on public.ocorrencias from authenticated;

create or replace function public.historico_penalidades(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ocorrencias
   where unidade_id = u and status in ('notificada','multada','mantida')
     and decidida_em > now() - interval '12 months';
$$;

-- Regra do Regimento Interno, Art. 82: notificação na 1ª vez; multa de 100% da menor taxa na reincidência;
-- em dobro a cada nova reincidência, até 5x; multa direta nas infrações listadas no artigo.
create or replace function public.sugerir_penalidade(p_ocorrencia uuid)
returns table (penalidade text, percentual numeric, fundamento text, historico int)
language plpgsql stable security definer set search_path = public as $$
declare o public.ocorrencias; direta boolean; h int;
begin
  if not (public.e_gestao() or public.tem_papel('conselho')) then raise exception 'Sem permissão'; end if;
  select * into o from public.ocorrencias where id = p_ocorrencia;
  select coalesce(e.multa_direta, false) into direta from public.enquadramentos e where e.id = o.enquadramento_id;
  h := public.historico_penalidades(o.unidade_id);
  if h = 0 and coalesce(direta, false) then
    return query select 'multa', 100::numeric, 'Infração com multa direta, sem notificação prévia (RI Art. 82).', h;
  elsif h = 0 then
    return query select 'notificacao', null::numeric, 'Primeira infração: notificação por escrito (RI Art. 81 e 82).', h;
  elsif h = 1 then
    return query select 'multa', 100::numeric, 'Reincidência após notificação: 100% da menor taxa (RI Art. 82).', h;
  else
    return query select 'multa', least(100 * power(2, h - 1), 500)::numeric,
      'Multa em dobro a cada reincidência, até 5x a menor taxa (RI Art. 82 §1º).', h;
  end if;
end $$;

create or replace function public.decidir_ocorrencia(p_id uuid, p_enquadramento text, p_decisao text, p_percentual numeric)
returns void language plpgsql security definer set search_path = public as $$
declare o public.ocorrencias;
begin
  if not public.e_gestao() then raise exception 'Apenas o síndico decide'; end if;
  select * into o from public.ocorrencias where id = p_id for update;
  if o.status <> 'em_analise' then raise exception 'Ocorrência já decidida'; end if;
  if p_decisao = 'arquivar' then
    update public.ocorrencias set status = 'arquivada', enquadramento_id = coalesce(p_enquadramento, enquadramento_id),
           decidida_por = auth.uid(), decidida_em = now() where id = p_id;
    return;
  end if;
  if p_decisao not in ('notificacao','multa') then raise exception 'Decisão inválida'; end if;
  update public.ocorrencias
     set status = case when p_decisao = 'multa' then 'multada' else 'notificada' end,
         penalidade = p_decisao,
         multa_percentual = case when p_decisao = 'multa' then least(coalesce(p_percentual, 100), 500) end,
         enquadramento_id = coalesce(p_enquadramento, enquadramento_id),
         decidida_por = auth.uid(), decidida_em = now()
   where id = p_id;
  perform public.avisar_unidade(o.unidade_id,
          case when p_decisao = 'multa' then 'Multa registrada' else 'Notificação recebida' end,
          'Veja os detalhes, dê ciência e, se quiser, recorra ao Conselho em até 10 dias.', '/notificacoes');
end $$;

create or replace function public.registrar_testemunhas(p_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.e_gestao() then raise exception 'Sem permissão'; end if;
  update public.ocorrencias set testemunhas = p_texto, ciencia_em = coalesce(ciencia_em, now()) where id = p_id;
end $$;

create or replace function public.dar_ciencia(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.ocorrencias;
begin
  select * into o from public.ocorrencias where id = p_id;
  if not public.e_membro(o.unidade_id) then raise exception 'Sem permissão'; end if;
  update public.ocorrencias set ciencia_em = coalesce(ciencia_em, now()) where id = p_id;
end $$;

create or replace function public.recorrer(p_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.ocorrencias;
begin
  select * into o from public.ocorrencias where id = p_id for update;
  if not public.e_membro(o.unidade_id) then raise exception 'Sem permissão'; end if;
  if o.status not in ('notificada','multada') then raise exception 'Não há decisão para recorrer'; end if;
  if now() > o.decidida_em + interval '10 days' then raise exception 'Prazo de recurso (10 dias corridos) encerrado'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'Escreva sua defesa'; end if;
  update public.ocorrencias set status = 'em_recurso', recurso_texto = p_texto, recurso_em = now(),
         ciencia_em = coalesce(ciencia_em, now()) where id = p_id;
  perform public.avisar_papel('conselho', 'Recurso para julgar', public.rotulo_unidade(o.unidade_id) || ' recorreu de uma penalidade.', '/conselho');
end $$;

create or replace function public.julgar_recurso(p_id uuid, p_manter boolean, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.ocorrencias;
begin
  if not public.tem_papel('conselho') then raise exception 'Apenas o Conselho julga recursos'; end if;
  select * into o from public.ocorrencias where id = p_id for update;
  if o.status <> 'em_recurso' then raise exception 'Ocorrência não está em recurso'; end if;
  update public.ocorrencias set status = case when p_manter then 'mantida' else 'cancelada' end,
         julgamento_texto = p_texto, julgada_por = auth.uid(), julgada_em = now() where id = p_id;
  perform public.avisar_unidade(o.unidade_id, 'Recurso julgado',
          case when p_manter then 'O Conselho manteve a penalidade.' else 'O Conselho cancelou a penalidade.' end, '/notificacoes');
end $$;

create or replace function public.ocorrencia_registrada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_papel('sindico', 'Nova ocorrência', public.rotulo_unidade(new.unidade_id) || ': ' || left(new.fato, 80), '/gestao/ocorrencias');
  return new;
end $$;
create trigger ocorrencia_registrada after insert on public.ocorrencias for each row execute function public.ocorrencia_registrada();

-- Reservas
create policy leitura on public.reservas for select to authenticated using (true);
create policy gestao  on public.reservas for update to authenticated using (public.e_gestao());
revoke insert, delete on public.reservas from authenticated;

create or replace function public.solicitar_reserva(p_espaco text, p_unidade uuid, p_data date, p_convidados int) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.espacos; r uuid;
begin
  if not public.e_membro(p_unidade) then raise exception 'Você não está vinculado a essa unidade'; end if;
  select * into e from public.espacos where id = p_espaco and ativo;
  if not found then raise exception 'Espaço indisponível'; end if;
  if p_data < current_date + e.antecedencia_min_dias then
    raise exception 'Reserve com pelo menos % dia(s) de antecedência', e.antecedencia_min_dias; end if;
  if p_convidados > e.max_convidados then raise exception 'Limite de % convidados para %', e.max_convidados, e.nome; end if;
  if (extract(month from p_data) = 12 and extract(day from p_data) in (24, 25, 31)) or (extract(month from p_data) = 1 and extract(day from p_data) = 1) then
    raise exception 'Natal e Ano Novo são reservados por sorteio (RI Art. 25)'; end if;
  insert into public.reservas (espaco_id, unidade_id, data, convidados, criada_por)
  values (p_espaco, p_unidade, p_data, p_convidados, auth.uid()) returning id into r;
  return r;
exception when unique_violation then
  raise exception 'Esta data já está reservada';
end $$;

create or replace function public.cancelar_reserva(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reservas;
begin
  select * into r from public.reservas where id = p_id;
  if not (public.e_membro(r.unidade_id) or public.e_gestao()) then raise exception 'Sem permissão'; end if;
  update public.reservas set status = 'cancelada' where id = p_id;
end $$;

-- Prestação de contas: rascunho só para gestão e conselho; publicado para todos
create policy leitura on public.contas_mensais for select to authenticated
  using (status <> 'rascunho' or public.e_gestao() or public.tem_papel('conselho'));
create policy gestao on public.contas_mensais for all to authenticated using (public.e_gestao()) with check (public.e_gestao());
create policy leitura on public.contas_lancamentos for select to authenticated
  using (exists (select 1 from public.contas_mensais c where c.id = conta_id));
create policy gestao on public.contas_lancamentos for all to authenticated using (public.e_gestao()) with check (public.e_gestao());
create policy leitura on public.contas_documentos for select to authenticated
  using (exists (select 1 from public.contas_mensais c where c.id = conta_id));
create policy gestao on public.contas_documentos for all to authenticated using (public.e_gestao()) with check (public.e_gestao());
create policy leitura on public.contas_duvidas for select to authenticated
  using (exists (select 1 from public.contas_mensais c where c.id = conta_id));
create policy perguntar on public.contas_duvidas for insert to authenticated with check (perfil_id = auth.uid());
create policy responder on public.contas_duvidas for update to authenticated using (public.e_gestao());

create or replace function public.registrar_parecer(p_conta uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.tem_papel('conselho') and not public.e_gestao() then raise exception 'Sem permissão'; end if;
  update public.contas_mensais set status = 'aprovada', parecer_em = now(), parecer_texto = p_texto
   where id = p_conta and status = 'publicada';
end $$;

create or replace function public.contas_publicadas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'publicada' and old.status = 'rascunho' then
    new.publicada_em := now();
    insert into public.avisos (perfil_id, titulo, corpo, link)
    select distinct perfil_id, 'Prestação de contas publicada', to_char(new.competencia, 'MM/YYYY'), '/contas/' || new.id
      from public.vinculos where status = 'aprovado';
    perform public.avisar_papel('conselho', 'Contas para parecer', to_char(new.competencia, 'MM/YYYY'), '/contas/' || new.id);
  end if;
  return new;
end $$;
create trigger contas_publicadas before update on public.contas_mensais for each row execute function public.contas_publicadas();

-- Avisos: cada um vê e marca os seus
create policy proprio on public.avisos for select to authenticated using (perfil_id = auth.uid());
create policy marcar  on public.avisos for update to authenticated using (perfil_id = auth.uid());
revoke insert, delete on public.avisos from authenticated;

-- Auditoria: só leitura para gestão e conselho
create policy leitura on public.auditoria for select to authenticated using (public.e_gestao() or public.tem_papel('conselho'));
revoke insert, update, delete on public.auditoria from authenticated;

-- ---------------------------------------------------------------------
-- Fotos (Supabase Storage): bucket privado, leitura por link assinado
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false) on conflict (id) do nothing;
    execute $p$create policy "fotos: enviar" on storage.objects for insert to authenticated with check (bucket_id = 'fotos')$p$;
    execute $p$create policy "fotos: ver" on storage.objects for select to authenticated using (bucket_id = 'fotos')$p$;
  end if;
end $$;
