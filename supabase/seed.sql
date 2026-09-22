-- Dados de exemplo — roda uma vez para ver o painel cheio.
--   npm run db:push -- supabase/seed.sql
-- Pode apagar os dois formulários pelo painel depois.

insert into public.forms (slug, title, description, client_name, intro, outro, password, status, theme, questions)
values
(
  'brisa-cafe-briefing',
  'Briefing de Identidade Visual',
  'Levantamento inicial para a nova marca.',
  'Brisa Café',
  'Leva uns 6 minutos. Pode salvar e voltar depois — as respostas ficam no seu navegador.',
  'Recebido! Voltamos em até 2 dias úteis com a primeira rodada.',
  'brisa2026',
  'published',
  '{"accent":"#d97706","surface":"paper","flow":"steps","cover":null}'::jsonb,
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'position', 1, 'section', 'A marca',        'type','text',     'label','Qual o nome oficial da empresa?',        'description', null, 'placeholder', null, 'required', true,  'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 2, 'section', 'A marca',        'type','textarea', 'label','Descreva o negócio em 3 frases.',         'description', null, 'placeholder', null, 'required', true,  'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 3, 'section', 'A marca',        'type','checkbox', 'label','Quais palavras traduzem a marca?',        'description', null, 'placeholder', null, 'required', true,  'options', '["Artesanal","Sofisticada","Acolhedora","Moderna","Popular","Sustentável"]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 4, 'section', 'Situação atual', 'type','radio',    'label','Já existe logo?',                         'description', null, 'placeholder', null, 'required', true,  'options', '["Sim","Não","Existe, mas queremos trocar"]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 5, 'section', 'Situação atual', 'type','url',      'label','Link de referência que vocês admiram',    'description', null, 'placeholder', null, 'required', false, 'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 6, 'section', 'Direção',        'type','scale',    'label','Quão ousada a marca pode ser?',           'description', '0 = discreta, 10 = radical', 'placeholder', null, 'required', true, 'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 7, 'section', 'Direção',        'type','date',     'label','Prazo desejado de entrega',               'description', null, 'placeholder', null, 'required', true,  'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 8, 'section', 'Contato',        'type','email',    'label','E-mail para retorno',                     'description', null, 'placeholder', null, 'required', true,  'options', '[]'::jsonb)
  )
),
(
  'norte-logistica-onboarding',
  'Onboarding — Dados do Cliente',
  'Cadastro e documentos para abertura de conta.',
  'Norte Logística',
  null,
  null,
  null,
  'draft',
  '{"accent":"#0891b2","surface":"ink","flow":"single","cover":null}'::jsonb,
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'position', 1, 'section', null, 'type','text',   'label','Razão social',                    'description', null, 'placeholder', null, 'required', true,  'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 2, 'section', null, 'type','text',   'label','CNPJ',                            'description', null, 'placeholder', null, 'required', true,  'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 3, 'section', null, 'type','phone',  'label','Telefone comercial',              'description', null, 'placeholder', null, 'required', true,  'options', '[]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 4, 'section', null, 'type','select', 'label','Regime tributário',               'description', null, 'placeholder', null, 'required', true,  'options', '["Simples Nacional","Lucro Presumido","Lucro Real"]'::jsonb),
    jsonb_build_object('id', gen_random_uuid(), 'position', 5, 'section', null, 'type','yesno',  'label','Já opera com carga refrigerada?', 'description', null, 'placeholder', null, 'required', false, 'options', '[]'::jsonb)
  )
)
on conflict (slug) do nothing;
