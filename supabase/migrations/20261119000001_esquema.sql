-- =====================================================================
-- App Parque Bello Solare — esquema do banco (Supabase / PostgreSQL)
-- Ordem: 01 esquema → 02 segurança (RLS) → 03 unidades e vagas → 04 regras
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Estrutura física (Convenção, Art. 2º e 6.1)
-- ---------------------------------------------------------------------
create table public.blocos (
  id            text primary key check (id ~ '^[A-J]$'),
  aptos_por_andar int not null check (aptos_por_andar in (8, 10)),
  subsindico_id uuid
);

create table public.unidades (
  id                    uuid primary key default gen_random_uuid(),
  bloco_id              text not null references public.blocos(id),
  numero                text not null check (numero ~ '^[1-4][0-9]{2}$'),
  andar                 int  generated always as (substr(numero, 1, 1)::int) stored,
  fracao_ideal          numeric(12, 9),
  -- código entregue ao morador para vincular a conta à unidade (gerado no banco, nunca no código-fonte)
  codigo_convite        text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  cadastro_revisado_em  date,
  unique (bloco_id, numero)
);

create table public.vagas (
  numero     int primary key check (numero between 1 and 406),
  unidade_id uuid not null references public.unidades(id),
  posicao    text not null default 'Descoberta Livre'
);

-- ---------------------------------------------------------------------
-- Pessoas e acesso
-- ---------------------------------------------------------------------
-- papéis: morador, portaria, subsindico, sindico, conselho, admin
create table public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  telefone   text,
  papeis     text[] not null default '{}'::text[]
             check (papeis <@ array['morador','portaria','subsindico','sindico','conselho','admin']::text[]),
  criado_em  timestamptz not null default now()
);

alter table public.blocos
  add constraint blocos_subsindico_fk foreign key (subsindico_id) references public.perfis(id) on delete set null;

create table public.vinculos (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  unidade_id    uuid not null references public.unidades(id),
  tipo          text not null check (tipo in ('proprietario','morador','inquilino')),
  status        text not null default 'pendente' check (status in ('pendente','aprovado','recusado','encerrado')),
  regimento_entregue boolean not null default false,   -- RI Art. 105 (inquilino)
  validado_por  uuid references public.perfis(id),
  validado_em   timestamptz,
  criado_em     timestamptz not null default now(),
  unique (perfil_id, unidade_id)
);

-- moradores e dependentes sem conta no app, contatos de emergência
create table public.pessoas (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         uuid not null references public.unidades(id),
  nome               text not null,
  relacao            text not null check (relacao in ('morador','dependente','contato_emergencia','proprietario_nao_residente')),
  telefone           text,
  endereco_correspondencia text,   -- RI Art. 85 I (proprietário que não reside)
  status             text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  criado_por         uuid references public.perfis(id),
  criado_em          timestamptz not null default now()
);

create table public.veiculos (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  uuid not null references public.unidades(id),
  placa       text not null check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  modelo      text not null,
  cor         text,
  vaga_numero int references public.vagas(numero),
  adesivo     text,                              -- RI Art. 92
  status      text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  criado_por  uuid references public.perfis(id),
  criado_em   timestamptz not null default now(),
  unique (placa)
);

create table public.pets (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  uuid not null references public.unidades(id),
  nome        text not null,
  especie     text not null,
  porte       text check (porte in ('pequeno','medio','grande')),
  status      text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  criado_por  uuid references public.perfis(id),
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Encomendas
-- ---------------------------------------------------------------------
create table public.encomendas (
  id                uuid primary key default gen_random_uuid(),
  unidade_id        uuid not null references public.unidades(id),
  descricao         text not null default 'Encomenda',
  foto_path         text,
  codigo_retirada   text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  registrada_por    uuid references public.perfis(id),
  registrada_em     timestamptz not null default now(),
  retirada_em       timestamptz,
  retirada_por_nome text,
  entregue_por      uuid references public.perfis(id)
);
create index on public.encomendas (unidade_id) where retirada_em is null;

-- ---------------------------------------------------------------------
-- Manutenção
-- ---------------------------------------------------------------------
create table public.chamados (
  id            uuid primary key default gen_random_uuid(),
  aberto_por    uuid not null references public.perfis(id),
  unidade_id    uuid references public.unidades(id),
  bloco_id      text references public.blocos(id),
  local         text not null,
  categoria     text not null check (categoria in ('Elétrica','Hidráulica','Limpeza','Portões','Áreas comuns','Outros')),
  titulo        text not null,
  descricao     text,
  foto_path     text,
  status        text not null default 'Aberto' check (status in ('Aberto','Em análise','Em execução','Concluído','Recusado')),
  resposta      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Ocorrências, notificações e multas (Regimento Interno, Cap. XIII)
-- ---------------------------------------------------------------------
create table public.enquadramentos (
  id            text primary key,
  titulo        text not null,
  base_legal    text not null,
  multa_direta  boolean not null default false   -- RI Art. 82: multa sem notificação prévia
);

create table public.ocorrencias (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         uuid not null references public.unidades(id),
  enquadramento_id   text references public.enquadramentos(id),
  fato               text not null,
  data_fato          date not null default current_date,
  foto_path          text,
  registrada_por     uuid not null references public.perfis(id),
  status             text not null default 'em_analise'
                     check (status in ('em_analise','notificada','multada','arquivada','em_recurso','mantida','cancelada')),
  penalidade         text check (penalidade in ('notificacao','multa')),
  multa_percentual   numeric(6,2),   -- % da menor taxa condominial
  decidida_por       uuid references public.perfis(id),
  decidida_em        timestamptz,
  ciencia_em         timestamptz,
  testemunhas        text,           -- RI Art. 82 §4º
  recurso_texto      text,
  recurso_em         timestamptz,
  julgamento_texto   text,           -- Conselho, RI Art. 82 §5º
  julgada_por        uuid references public.perfis(id),
  julgada_em         timestamptz,
  criada_em          timestamptz not null default now()
);
create index on public.ocorrencias (unidade_id);

-- ---------------------------------------------------------------------
-- Reservas de áreas comuns (RI Art. 21 e seguintes)
-- ---------------------------------------------------------------------
create table public.espacos (
  id              text primary key,
  nome            text not null,
  horario         text not null,
  max_convidados  int  not null,
  taxa            text not null,
  antecedencia_min_dias int not null default 1,
  ativo           boolean not null default true
);

create table public.reservas (
  id          uuid primary key default gen_random_uuid(),
  espaco_id   text not null references public.espacos(id),
  unidade_id  uuid not null references public.unidades(id),
  data        date not null,
  convidados  int  not null default 0 check (convidados >= 0),
  status      text not null default 'solicitada' check (status in ('solicitada','confirmada','cancelada')),
  criada_por  uuid not null references public.perfis(id),
  criada_em   timestamptz not null default now()
);
create unique index reservas_espaco_data_unica on public.reservas (espaco_id, data) where status <> 'cancelada';

-- ---------------------------------------------------------------------
-- Prestação de contas
-- ---------------------------------------------------------------------
create table public.contas_mensais (
  id                uuid primary key default gen_random_uuid(),
  competencia       date not null unique check (extract(day from competencia) = 1),
  status            text not null default 'rascunho' check (status in ('rascunho','publicada','aprovada')),
  fundo_reserva     numeric(14,2),
  inadimplencia_pct numeric(5,2),
  observacoes       text,
  publicada_em      timestamptz,
  parecer_em        timestamptz,
  parecer_texto     text
);

create table public.contas_lancamentos (
  id         uuid primary key default gen_random_uuid(),
  conta_id   uuid not null references public.contas_mensais(id) on delete cascade,
  tipo       text not null check (tipo in ('receita','despesa')),
  categoria  text not null,
  valor      numeric(14,2) not null check (valor >= 0)
);

create table public.contas_documentos (
  id           uuid primary key default gen_random_uuid(),
  conta_id     uuid not null references public.contas_mensais(id) on delete cascade,
  titulo       text not null,
  arquivo_path text not null
);

create table public.contas_duvidas (
  id            uuid primary key default gen_random_uuid(),
  conta_id      uuid not null references public.contas_mensais(id) on delete cascade,
  perfil_id     uuid not null references public.perfis(id),
  pergunta      text not null,
  resposta      text,
  respondida_em timestamptz,
  criada_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Avisos dentro do app e parâmetros
-- ---------------------------------------------------------------------
create table public.avisos (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  titulo     text not null,
  corpo      text,
  link       text,
  lido       boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index on public.avisos (perfil_id, lido);

create table public.configuracoes (
  chave  text primary key,
  valor  text not null,
  descricao text
);

-- ---------------------------------------------------------------------
-- Auditoria (quem fez o quê e quando)
-- ---------------------------------------------------------------------
create table public.auditoria (
  id         bigint generated always as identity primary key,
  tabela     text not null,
  registro   text,
  acao       text not null,
  perfil_id  uuid,
  antes      jsonb,
  depois     jsonb,
  em         timestamptz not null default now()
);

create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria (tabela, registro, acao, perfil_id, antes, depois)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', null),
          tg_op, auth.uid(),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['perfis','vinculos','pessoas','veiculos','pets','encomendas','chamados',
                           'ocorrencias','reservas','contas_mensais','contas_lancamentos','configuracoes','blocos']
  loop
    execute format('create trigger auditoria_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;
