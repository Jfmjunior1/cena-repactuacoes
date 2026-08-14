-- ============================================================
--  Campo "vista" por contrato
--  A planilha do Financeiro não tem essa informação: ela aparece
--  apenas embutida no nome de duas unidades (S113 e S209, "vista mar").
--  Aqui o campo passa a ser preenchido no próprio painel, por um editor,
--  e a sincronização com a planilha nunca o sobrescreve.
--
--  Execute no SQL Editor do Supabase, uma única vez.
-- ============================================================

alter table public.contratos     add column if not exists vista text;
alter table public.repactuacoes  add column if not exists vista text;

-- semeia o que dá para deduzir do nome da unidade
update public.contratos    set vista = 'Sim' where vista is null and unidade ilike '%vista%';
update public.repactuacoes set vista = 'Sim' where vista is null and unidade ilike '%vista%';

-- ---------- gravação a partir do painel ----------
-- Aplica o valor ao contrato e a todos os seus ciclos de repactuação,
-- para que a ficha não divirja de um ano para outro.
create or replace function public.definir_vista(p_contrato text, p_vista text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer := 0;
begin
  if not public.eh_editor() then
    raise exception 'somente editores podem alterar a vista';
  end if;
  if p_vista is not null and p_vista not in ('Sim','Não') then
    raise exception 'valor invalido para vista: %', p_vista;
  end if;

  update public.contratos set vista = p_vista where id = p_contrato;
  update public.repactuacoes set vista = p_vista where id like p_contrato || '|%';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.definir_vista(text, text) from public;
revoke all on function public.definir_vista(text, text) from anon;
grant execute on function public.definir_vista(text, text) to authenticated;

-- Conferência:
--   select vista, count(*) from public.contratos group by vista;
