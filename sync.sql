-- ============================================================
--  Sincronização automática com a planilha do Financeiro
--  "Controle Contratos de Locação 2023, 2024, 2025 e 2026.xlsx"
--  SharePoint → Financeiro → Controles financeiros diversos
--
--  Execute este arquivo INTEIRO no SQL Editor do Supabase, uma única vez.
--  Depois troque o token na última seção por um valor secreto seu.
-- ============================================================

-- ---------- 1. Espelho da planilha ----------
-- Uma linha por contrato, exatamente como está na aba "Consolidado - Imóveis".
create table if not exists public.contratos (
  id             text primary key,          -- sigla|unidade|primeiros 16 do cliente
  sigla          text,
  cliente        text not null,
  unidade        text,
  garagem        text,
  m2             numeric(12,2),
  valor          numeric(14,2),
  rm2_controle   numeric(12,2),
  inicio         date,
  fim            date,
  ultima_reneg   date,
  proxima_reneg  date,
  historico      text,
  locador        text,
  administracao  text,
  situacao       text,
  ativo          boolean not null default true,
  visto_em       timestamptz not null default now(),
  alterado_em    timestamptz not null default now()
);
create index if not exists idx_contratos_sigla on public.contratos(sigla);

create table if not exists public.sincronizacoes (
  id             bigint generated always as identity primary key,
  origem         text,
  recebidos      int default 0,
  novos          int default 0,
  alterados      int default 0,
  ausentes       int default 0,
  ciclos_criados int default 0,
  ciclos_ajustados int default 0,
  mudancas       jsonb default '[]'::jsonb,
  criado_em      timestamptz not null default now()
);

create table if not exists public.config_sync (
  chave text primary key,
  valor text not null
);

alter table public.repactuacoes add column if not exists fonte text;
alter table public.repactuacoes add column if not exists revisar boolean not null default false;

-- Regra conservadora: casos especiais ficam para revisão e não entram nos totais.
create or replace function public.contrato_exige_revisao(
  p_sigla text, p_cliente text, p_unidade text, p_valor numeric, p_situacao text
) returns boolean
language sql
immutable
as $$
  select
    upper(trim(coalesce(p_cliente,''))) = 'VAGO'
    or upper(coalesce(p_cliente,'')) like 'CENA/%'
    or upper(coalesce(p_cliente,'')) = 'CENA'
    or upper(coalesce(p_cliente,'')) like 'DU LAC/%'
    or upper(coalesce(p_cliente,'')) = 'DU LAC'
    or (upper(coalesce(p_cliente,'')) like '%PETZ%' and upper(coalesce(p_sigla,'')) = 'CAIS')
    or (upper(coalesce(p_cliente,'')) like '%FORMULA%' and upper(coalesce(p_sigla,'')) = 'TROMP')
    or (upper(coalesce(p_cliente,'')) like '%FÓRMULA%' and upper(coalesce(p_sigla,'')) = 'TROMP')
    or upper(coalesce(p_situacao,'')) like '%USO PRÓPRIO%'
    or upper(coalesce(p_situacao,'')) like '%USO PROPRIO%'
    or upper(coalesce(p_situacao,'')) like '%NÃO PERMITE RENEGOCIA%'
    or upper(coalesce(p_situacao,'')) like '%NAO PERMITE RENEGOCIA%'
    or upper(coalesce(p_situacao,'')) like '%DESOCUPA%'
    or (coalesce(p_valor,0)=0 and upper(coalesce(p_cliente,''))='VAGO');
$$;

create or replace function public.sincronizar_planilha(p_token text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text; v_ids text[] := '{}'; v_novos int := 0; v_alt int := 0; v_aus int := 0;
  v_cri int := 0; v_ajs int := 0; v_mud jsonb := '[]'::jsonb; r jsonb; v_id text;
  v_ant public.contratos%rowtype; ct public.contratos%rowtype; v_base date; v_data date;
  v_indet boolean; v_max int; v_n int; v_origem text; v_rid text; v_sinc bigint;
begin
  select valor into v_token from public.config_sync where chave = 'token_sync';
  if v_token is null then raise exception 'token de sincronizacao nao configurado'; end if;
  if p_token is distinct from v_token then raise exception 'token invalido'; end if;
  if jsonb_typeof(p_dados) <> 'array' then raise exception 'p_dados deve ser um array JSON'; end if;
  if jsonb_array_length(p_dados) < 20 then
    raise exception 'planilha devolveu apenas % contratos - sincronizacao abortada por seguranca', jsonb_array_length(p_dados);
  end if;

  for r in select * from jsonb_array_elements(p_dados) loop
    if coalesce(trim(r->>'cliente'),'') = '' then continue; end if;
    v_id := concat_ws('|', r->>'sigla', coalesce(r->>'unidade','-'), left(r->>'cliente', 16));
    v_ids := array_append(v_ids, v_id);
    select * into v_ant from public.contratos where id = v_id;

    insert into public.contratos as t (
      id, sigla, cliente, unidade, garagem, m2, valor, rm2_controle,
      inicio, fim, ultima_reneg, proxima_reneg, historico, locador,
      administracao, situacao, ativo, visto_em, alterado_em)
    values (
      v_id, r->>'sigla', r->>'cliente', r->>'unidade', r->>'garagem',
      nullif(r->>'m2','')::numeric, nullif(r->>'valor','')::numeric, nullif(r->>'rm2','')::numeric,
      nullif(r->>'inicio','')::date, nullif(r->>'fim','')::date,
      nullif(r->>'ultima','')::date, nullif(r->>'proxima','')::date,
      r->>'historico', r->>'locador', r->>'administracao', r->>'situacao',
      true, now(), now())
    on conflict (id) do update set
      sigla = excluded.sigla, cliente = excluded.cliente, unidade = excluded.unidade,
      garagem = excluded.garagem, m2 = excluded.m2, valor = excluded.valor,
      rm2_controle = excluded.rm2_controle, inicio = excluded.inicio, fim = excluded.fim,
      ultima_reneg = excluded.ultima_reneg, proxima_reneg = excluded.proxima_reneg,
      historico = excluded.historico, locador = excluded.locador,
      administracao = excluded.administracao, situacao = excluded.situacao,
      ativo = true, visto_em = now(),
      alterado_em = case when t.valor is distinct from excluded.valor
                          or t.m2 is distinct from excluded.m2
                          or t.fim is distinct from excluded.fim
                          or t.proxima_reneg is distinct from excluded.proxima_reneg
                          or t.ultima_reneg is distinct from excluded.ultima_reneg
                         then now() else t.alterado_em end;

    if v_ant.id is null then
      v_novos := v_novos + 1;
      v_mud := v_mud || jsonb_build_object('tipo','novo','contrato',v_id,'valor',r->>'valor');
    elsif v_ant.valor is distinct from nullif(r->>'valor','')::numeric
       or v_ant.fim is distinct from nullif(r->>'fim','')::date
       or v_ant.proxima_reneg is distinct from nullif(r->>'proxima','')::date
       or v_ant.ultima_reneg is distinct from nullif(r->>'ultima','')::date then
      v_alt := v_alt + 1;
      v_mud := v_mud || jsonb_build_object('tipo','alterado','contrato',v_id);
    end if;
  end loop;

  update public.contratos set ativo = false where ativo = true and not (id = any(v_ids));
  get diagnostics v_aus = row_count;

  update public.repactuacoes rp set
    valor=c.valor, m2=c.m2, garagem=c.garagem, inicio=c.inicio, fim=c.fim,
    prazo=case when c.fim is null or c.fim < current_date then 'Indet.' else lower(to_char(c.fim,'TMmon')) || '/' || to_char(c.fim,'YY') end,
    locador=c.locador, administracao=c.administracao, rm2_controle=c.rm2_controle, situacao_contrato=c.situacao
  from public.contratos c
  where rp.id like c.id || '|%' and rp.status is distinct from 'Concluído' and rp.valor_rep is null
    and (rp.valor is distinct from c.valor or rp.m2 is distinct from c.m2 or rp.fim is distinct from c.fim);
  get diagnostics v_ajs = row_count;

  for ct in select * from public.contratos where ativo = true loop
    if ct.proxima_reneg is not null then v_base := ct.proxima_reneg; v_origem := 'Próxima renegociação da planilha';
    elsif ct.ultima_reneg is not null then v_base := ct.ultima_reneg + interval '3 years'; v_origem := 'Última renegociação + 3 anos';
    elsif ct.inicio is not null then v_base := ct.inicio + interval '3 years'; v_origem := 'Início do contrato + 3 anos';
    else continue; end if;

    while v_base <= current_date loop v_base := v_base + interval '3 years'; end loop;
    v_indet := ct.fim is null or ct.fim < current_date;
    v_max := case when v_indet then 2 else 12 end;
    v_data := v_base; v_n := 0;

    while v_n < v_max and (v_indet or v_data <= ct.fim) loop
      v_rid := ct.id || '|' || to_char(v_data,'YYYY-MM-DD');
      if not exists (select 1 from public.repactuacoes where id = v_rid) then
        insert into public.repactuacoes (
          id, ano, data, sigla, cliente, unidade, garagem, m2, valor, status, prazo,
          inicio, fim, ult_repactuacao, origem, locador, administracao, rm2_controle,
          situacao_contrato, sem_previsao, fonte, vista, revisar)
        values (
          v_rid, extract(year from v_data)::int, v_data, ct.sigla, ct.cliente, ct.unidade,
          ct.garagem, ct.m2, ct.valor, 'Previsto',
          case when v_indet then 'Indet.' else lower(to_char(ct.fim,'TMmon')) || '/' || to_char(ct.fim,'YY') end,
          ct.inicio, ct.fim, ct.historico, v_origem, ct.locador, ct.administracao,
          ct.rm2_controle, ct.situacao, false, 'planilha', ct.vista,
          public.contrato_exige_revisao(ct.sigla,ct.cliente,ct.unidade,ct.valor,ct.situacao));
        v_cri := v_cri + 1;
        v_mud := v_mud || jsonb_build_object('tipo','ciclo_novo','contrato',ct.id,'data',v_data);
      end if;
      v_data := v_data + interval '3 years'; v_n := v_n + 1;
    end loop;
  end loop;

  update public.repactuacoes rp set revisar = true
   from public.contratos c
  where rp.id like c.id || '|' and rp.status = 'Previsto' and rp.fonte = 'planilha'
    and public.contrato_exige_revisao(c.sigla,c.cliente,c.unidade,c.valor,c.situacao)
    and rp.revisar = false;

  update public.repactuacoes rp set revisar = true
   from public.contratos c
  where rp.id like c.id || '|' and c.ativo = false and rp.status = 'Previsto' and rp.revisar = false;

  insert into public.sincronizacoes (origem, recebidos, novos, alterados, ausentes, ciclos_criados, ciclos_ajustados, mudancas)
  values ('power-automate', jsonb_array_length(p_dados), v_novos, v_alt, v_aus, v_cri, v_ajs, v_mud)
  returning id into v_sinc;

  return jsonb_build_object('ok',true,'sincronizacao',v_sinc,'recebidos',jsonb_array_length(p_dados),
    'novos',v_novos,'alterados',v_alt,'ausentes',v_aus,'ciclos_criados',v_cri,'ciclos_ajustados',v_ajs);
end $$;

alter table public.contratos enable row level security;
alter table public.sincronizacoes enable row level security;
alter table public.config_sync enable row level security;

drop policy if exists contratos_leitura on public.contratos;
create policy contratos_leitura on public.contratos for select to authenticated using (true);
drop policy if exists sinc_leitura on public.sincronizacoes;
create policy sinc_leitura on public.sincronizacoes for select to authenticated using (true);

revoke all on function public.sincronizar_planilha(text, jsonb) from public;
grant execute on function public.sincronizar_planilha(text, jsonb) to anon, authenticated;

insert into public.config_sync (chave, valor)
values ('token_sync', 'TROQUE-ESTE-VALOR-POR-UM-SEGREDO-FORTE')
on conflict (chave) do nothing;