# Notas para quem for mexer no código

- Permissões vivem no banco (RLS + funções `security definer` em `supabase/migrations/..._seguranca_e_regras.sql`).
  Toda tela nova deve continuar funcionando só com a chave anon + login do usuário.
- `unidades.codigo_convite` e `encomendas.codigo_retirada` têm privilégio por coluna: nunca use `select('*')`
  nessas tabelas; use `codigos_convite()` e `minhas_encomendas()`.
- `vinculos` tem duas FKs para `perfis` (perfil_id e validado_por): embeds precisam de
  `perfis!vinculos_perfil_id_fkey(...)`.
- Formulários com mais de um botão: use `formAction` em cada botão (o valor do botão não chega ao server action) e
  um botão padrão invisível se Enter não puder disparar a primeira ação.
- Rode `supabase/testes/rodar_testes.sh` depois de mudar SQL.
