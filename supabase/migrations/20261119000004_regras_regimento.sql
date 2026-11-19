-- =====================================================================
-- Regras do Regimento Interno (AGE 14/04/2019) usadas pelo app.
-- A gestão pode ajustar tudo isto depois, pela tabela ou pelo painel.
-- =====================================================================

-- multa_direta = true: infrações em que o RI Art. 82 permite multa sem notificação prévia
insert into public.enquadramentos (id, titulo, base_legal, multa_direta) values
  ('sossego',        'Sossego e barulho (silêncio das 22h às 7h)',                 'Conv. Art. 8º f; RI Art. 8º VII e Art. 82', true),
  ('horario_espacos','Horário de uso dos espaços comuns',                          'RI Art. 82',                                true),
  ('salubridade',    'Salubridade e higiene',                                     'RI Art. 82',                                true),
  ('mudanca',        'Mudança fora do horário ou sem agendamento',                'RI Art. 8º XVII e Art. 82',                 true),
  ('obras',          'Obra ou reforma fora do horário ou sem aviso prévio',       'RI Art. 8º XVI, Art. 9º XXXIX e Art. 82',   true),
  ('cadastro',       'Cadastro da unidade desatualizado',                          'RI Art. 82',                                true),
  ('vaga_alheia',    'Uso de vaga de outra unidade sem autorização escrita',      'RI Art. 9º XXXV',                           false),
  ('pets',           'Animal em área comum fora das regras',                      'RI Art. 9º XLI',                            false),
  ('fachada',        'Roupas ou objetos em janelas; alteração de fachada',        'Conv. Art. 8º d e g; RI Art. 95',           false),
  ('objetos',        'Lançar objetos ou detritos',                                'Conv. Art. 8º e',                           false),
  ('veiculos',       'Velocidade acima de 20 km/h ou adesivo ausente',            'RI Art. 18 e Art. 92',                      false),
  ('espacos',        'Infração em salão, churrasqueira, gourmet ou academia',     'RI Art. 21 §26 e Art. 62',                  false),
  ('vazamento',      'Vazamento na unidade não reparado em 48h',                  'RI Art. 8º VIII',                           false),
  ('outros',         'Outra infração (descrever no fato)',                         'Convenção / Regimento Interno',             false);

insert into public.espacos (id, nome, horario, max_convidados, taxa, antecedencia_min_dias) values
  ('salao',         'Salão de festas', '9h às 22h (até 23h sex, sáb e véspera de feriado)', 50, '21% da menor taxa condominial', 1),
  ('churrasqueira', 'Churrasqueira',   '9h às 22h (até 23h sex, sáb e véspera de feriado)', 50, '21% da menor taxa condominial', 1),
  ('gourmet',       'Espaço gourmet',  '10h às 23h59',                                       32, '10% da menor taxa condominial', 1);

insert into public.configuracoes (chave, valor, descricao) values
  ('menor_taxa_condominial', '0', 'Valor em R$ da menor taxa condominial vigente (base das multas, RI Art. 82). Atualize no painel.'),
  ('maior_taxa_condominial', '0', 'Valor em R$ da maior taxa condominial vigente (base de algumas penalidades de espaços).'),
  ('prazo_recurso_dias',     '10', 'Prazo para recurso ao Conselho (RI Art. 82 §5º).'),
  ('dias_guardar_fotos_encomenda', '90', 'Fotos de encomendas entregues são apagadas após este prazo (LGPD).');
