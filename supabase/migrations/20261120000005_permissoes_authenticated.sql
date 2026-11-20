-- =====================================================================
-- Permissões de tabela para usuários logados (role "authenticated")
-- Projetos novos do Supabase não concedem acesso automático às tabelas
-- criadas no schema public. Sem isto, o app recebe "permission denied"
-- e trata todo mundo como "Cadastro em andamento".
-- O RLS continua ativo: as policies decidem QUAIS linhas cada um vê.
-- =====================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Reaplica as restrições por coluna/operação da migração 0002
revoke select on public.unidades from authenticated;
grant select (id, bloco_id, numero, andar, fracao_ideal, cadastro_revisado_em) on public.unidades to authenticated;
revoke update on public.unidades from authenticated;
grant update (cadastro_revisado_em) on public.unidades to authenticated;

revoke update on public.perfis from authenticated;
grant update (nome, telefone) on public.perfis to authenticated;

revoke insert, update, delete on public.vinculos from authenticated;

revoke select, update, delete on public.encomendas from authenticated;
grant select (id, unidade_id, descricao, foto_path, registrada_por, registrada_em, retirada_em, retirada_por_nome, entregue_por)
  on public.encomendas to authenticated;

revoke update, delete on public.ocorrencias from authenticated;
revoke insert, delete on public.reservas from authenticated;
revoke insert, delete on public.avisos from authenticated;
revoke insert, update, delete on public.auditoria from authenticated;

-- Visitantes não logados continuam sem acesso às tabelas
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
