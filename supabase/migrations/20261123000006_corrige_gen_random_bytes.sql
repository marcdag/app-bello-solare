-- Corrige "function gen_random_bytes(integer) does not exist" ao gerar novo código de convite.
-- No Supabase a extensão pgcrypto fica no schema "extensions", que não estava no search_path da função.
create or replace function public.novo_codigo_convite(u uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  if not public.e_gestao() then raise exception 'Apenas a gestão'; end if;
  update public.unidades set codigo_convite = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
   where id = u returning codigo_convite into c;
  return c;
end $$;
