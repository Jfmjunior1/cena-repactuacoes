-- ============================================================
--  Importação a partir do painel (sem Power Automate)
--  Permite que um EDITOR logado grave a planilha lida no navegador,
--  sem que o segredo do fluxo precise sair do banco.
--  Execute no SQL Editor depois do sync.sql.
-- ============================================================

create or replace function public.sincronizar_do_painel(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.eh_editor() then
    raise exception 'somente editores podem atualizar a partir da planilha';
  end if;
  select valor into v_token from public.config_sync where chave = 'token_sync';
  if v_token is null then
    raise exception 'token de sincronizacao nao configurado';
  end if;
  return public.sincronizar_planilha(v_token, p_dados);
end $$;

revoke all on function public.sincronizar_do_painel(jsonb) from public;
revoke all on function public.sincronizar_do_painel(jsonb) from anon;
grant execute on function public.sincronizar_do_painel(jsonb) to authenticated;

-- leitura do histórico de sincronizações pelo painel
drop policy if exists sinc_leitura on public.sincronizacoes;
create policy sinc_leitura on public.sincronizacoes
  for select to authenticated using (true);
