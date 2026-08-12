-- ============================================================
--  Painel de Repactuações de Locação — Cena Empreendimentos
--  Esquema do banco (Supabase / PostgreSQL)
--  Execute este arquivo INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- ---------- 1. Perfis de acesso ----------
-- Cada usuário criado em Authentication → Users ganha uma linha aqui.
-- papel: 'editor' (altera dados) ou 'leitor' (só consulta).
create table if not exists public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  email      text,
  papel      text not null default 'leitor' check (papel in ('editor','leitor')),
  criado_em  timestamptz not null default now()
);

-- cria o perfil automaticamente quando um usuário é adicionado
create or replace function public.cria_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.cria_perfil();

-- helper: o usuário logado é editor?
create or replace function public.eh_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'editor' from public.perfis where id = auth.uid()), false);
$$;

-- ---------- 2. Empreendimentos ----------
create table if not exists public.empreendimentos (
  sigla text primary key,
  nome  text not null,
  cor   text not null default '#4c5a66',
  ordem int
);

-- ---------- 3. Repactuações ----------
-- Uma linha por repactuação (contrato × ciclo). Também guarda os contratos
-- sem previsão de repactuação, marcados com sem_previsao = true.
create table if not exists public.repactuacoes (
  id                text primary key,
  ano               int,
  data              date,
  sigla             text references public.empreendimentos(sigla),
  cliente           text not null,
  unidade           text,
  garagem           text,
  m2                numeric(12,2),
  valor             numeric(14,2),          -- aluguel atual
  alvo_m2           numeric(12,2),          -- R$/m² alvo (só onde o Comercial definiu)
  valor_alvo        numeric(14,2),
  rm2_rep           numeric(12,2),          -- R$/m² efetivamente repactuado
  valor_rep         numeric(14,2),          -- valor efetivamente repactuado
  pct               numeric(6,4),           -- % de reajuste obtido (0,104 = 10,4%)
  status            text,                   -- Concluído · Em negociação · Aguardando data · Previsto · Sem previsão
  mes_com           text,                   -- mês sugerido para abrir a tratativa
  mes_rep           text,                   -- mês da repactuação
  prazo             text,                   -- vigência em mmm/aa ou "Indet."
  inicio            date,
  fim               date,
  ult_repactuacao   text,
  origem            text,                   -- critério usado para calcular a data
  locador           text,
  administracao     text,
  rm2_controle      numeric(12,2),          -- R$/m² registrado na planilha de origem
  plano_2026        boolean not null default false,
  sem_previsao      boolean not null default false,
  situacao_contrato text,

  -- campos de trabalho (editáveis no painel)
  simulacao         numeric(14,2),
  etapa             text,                   -- A iniciar · Aguardando prazo · Em preparação · Em negociação · Proposta enviada · Concluída · Sem êxito
  responsavel       text,
  proximo_contato   date,
  atualizado_em     timestamptz,
  atualizado_por    text
);

create index if not exists idx_repact_ano   on public.repactuacoes(ano);
create index if not exists idx_repact_sigla on public.repactuacoes(sigla);
create index if not exists idx_repact_etapa on public.repactuacoes(etapa);

-- ---------- 4. Anotações da tratativa ----------
create table if not exists public.anotacoes (
  id             bigint generated always as identity primary key,
  repactuacao_id text not null references public.repactuacoes(id) on delete cascade,
  texto          text not null,
  autor          text,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_anot_repact on public.anotacoes(repactuacao_id, criado_em desc);

-- ---------- 5. Histórico de alterações ----------
create table if not exists public.historico (
  id             bigint generated always as identity primary key,
  repactuacao_id text,
  campo          text,
  valor_antigo   text,
  valor_novo     text,
  autor          text,
  criado_em      timestamptz not null default now()
);

create or replace function public.registra_historico()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quem text := coalesce((select email from public.perfis where id = auth.uid()), 'sistema');
begin
  if new.simulacao is distinct from old.simulacao then
    insert into public.historico(repactuacao_id,campo,valor_antigo,valor_novo,autor)
    values (new.id,'simulacao',old.simulacao::text,new.simulacao::text,quem);
  end if;
  if new.etapa is distinct from old.etapa then
    insert into public.historico(repactuacao_id,campo,valor_antigo,valor_novo,autor)
    values (new.id,'etapa',old.etapa,new.etapa,quem);
  end if;
  if new.valor_rep is distinct from old.valor_rep then
    insert into public.historico(repactuacao_id,campo,valor_antigo,valor_novo,autor)
    values (new.id,'valor_rep',old.valor_rep::text,new.valor_rep::text,quem);
  end if;
  new.atualizado_em := now();
  new.atualizado_por := quem;
  return new;
end $$;

drop trigger if exists trg_hist_repact on public.repactuacoes;
create trigger trg_hist_repact
  before update on public.repactuacoes
  for each row execute function public.registra_historico();

-- ============================================================
--  Segurança em nível de linha (RLS)
--  Ninguém lê nada sem estar autenticado. Só editores escrevem.
-- ============================================================
alter table public.perfis          enable row level security;
alter table public.empreendimentos enable row level security;
alter table public.repactuacoes    enable row level security;
alter table public.anotacoes       enable row level security;
alter table public.historico       enable row level security;

-- perfis: cada um enxerga o próprio; editores enxergam todos
drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis for select to authenticated
  using (id = auth.uid() or public.eh_editor());

-- empreendimentos
drop policy if exists emp_leitura on public.empreendimentos;
create policy emp_leitura on public.empreendimentos for select to authenticated using (true);
drop policy if exists emp_escrita on public.empreendimentos;
create policy emp_escrita on public.empreendimentos for all to authenticated
  using (public.eh_editor()) with check (public.eh_editor());

-- repactuações
drop policy if exists rep_leitura on public.repactuacoes;
create policy rep_leitura on public.repactuacoes for select to authenticated using (true);
drop policy if exists rep_update on public.repactuacoes;
create policy rep_update on public.repactuacoes for update to authenticated
  using (public.eh_editor()) with check (public.eh_editor());
drop policy if exists rep_insert on public.repactuacoes;
create policy rep_insert on public.repactuacoes for insert to authenticated
  with check (public.eh_editor());
drop policy if exists rep_delete on public.repactuacoes;
create policy rep_delete on public.repactuacoes for delete to authenticated
  using (public.eh_editor());

-- anotações
drop policy if exists anot_leitura on public.anotacoes;
create policy anot_leitura on public.anotacoes for select to authenticated using (true);
drop policy if exists anot_insert on public.anotacoes;
create policy anot_insert on public.anotacoes for insert to authenticated
  with check (public.eh_editor());
drop policy if exists anot_delete on public.anotacoes;
create policy anot_delete on public.anotacoes for delete to authenticated
  using (public.eh_editor());

-- histórico: leitura para todos os autenticados, escrita só pelo trigger
drop policy if exists hist_leitura on public.historico;
create policy hist_leitura on public.historico for select to authenticated using (true);

-- ============================================================
--  Depois de rodar este arquivo:
--   1. rode o supabase/seed.sql (carrega os dados)
--   2. crie os usuários em Authentication → Users
--   3. marque quem edita:
--      update public.perfis set papel = 'editor' where email = 'adm@cenaempreendimentos.com.br';
-- ============================================================
