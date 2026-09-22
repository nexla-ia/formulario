-- ═══════════════════════════════════════════════════════════════════
--  Formulários · schema do Supabase
--  Como usar: Supabase → SQL Editor → cola tudo → Run.
--  Pode rodar de novo sem medo (tudo é idempotente).
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Tabelas ───────────────────────────────────────────────────────

create table if not exists public.forms (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  description  text,
  client_name  text,
  intro        text,
  outro        text,
  password     text,
  status       text not null default 'draft'
               check (status in ('draft','published','closed')),
  theme        jsonb not null default '{}'::jsonb,
  questions    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.responses (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.forms(id) on delete cascade,
  respondent   text,
  answers      jsonb not null default '[]'::jsonb,
  meta         jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

-- Cliente pode reabrir o link com a senha e corrigir o que enviou.
-- Ligado, o formulário vira um documento vivo: uma resposta por formulário,
-- editada quantas vezes precisar. Desligado, cada envio é uma resposta nova.
alter table public.forms     add column if not exists allow_edit  boolean not null default true;
alter table public.responses add column if not exists updated_at  timestamptz;
alter table public.responses add column if not exists edits       integer not null default 0;

create index if not exists responses_form_id_idx on public.responses (form_id);
create index if not exists forms_slug_idx        on public.forms (slug);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists forms_touch on public.forms;
create trigger forms_touch before update on public.forms
  for each row execute function public.touch_updated_at();

-- ── RPCs públicas (o link do cliente só usa estas 3) ──────────────
-- SECURITY DEFINER: funcionam mesmo com RLS fechada, e nunca
-- devolvem a coluna `password` nem as perguntas de um rascunho.

create or replace function public.form_public(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',          f.id,
    'slug',        f.slug,
    'title',       f.title,
    'description', f.description,
    'client_name', f.client_name,
    'intro',       f.intro,
    'status',      f.status,
    'theme',       f.theme,
    'allow_edit',  f.allow_edit,
    'locked',      (f.password is not null and f.password <> '')
  )
  from public.forms f
  where f.slug = p_slug;
$$;

create or replace function public.form_unlock(p_slug text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare f public.forms%rowtype;
begin
  select * into f from public.forms where slug = p_slug;
  if not found                       then return jsonb_build_object('ok', false, 'reason', 'missing'); end if;
  if f.status = 'closed'             then return jsonb_build_object('ok', false, 'reason', 'closed');  end if;
  if f.status = 'draft'              then return jsonb_build_object('ok', false, 'reason', 'draft');   end if;
  if coalesce(f.password,'') <> ''
     and f.password <> coalesce(p_password,'')
                                     then return jsonb_build_object('ok', false, 'reason', 'password'); end if;

  return jsonb_build_object(
    'ok', true,
    'form', jsonb_build_object(
      'id', f.id, 'slug', f.slug, 'title', f.title, 'description', f.description,
      'client_name', f.client_name, 'intro', f.intro, 'outro', f.outro,
      'status', f.status, 'theme', f.theme, 'questions', f.questions,
      'allow_edit', f.allow_edit,
      'created_at', f.created_at, 'updated_at', f.updated_at
    ),
    -- Quem tem a senha reabre o próprio documento: devolve o que já foi
    -- enviado para a tela vir preenchida.
    'response', case when f.allow_edit then (
      select jsonb_build_object(
        'id', r.id, 'answers', r.answers, 'respondent', r.respondent,
        'submitted_at', r.submitted_at, 'updated_at', r.updated_at, 'edits', r.edits
      )
      from public.responses r
      where r.form_id = f.id
      order by r.submitted_at desc
      limit 1
    ) else null end
  );
end $$;

create or replace function public.form_submit(
  p_slug text, p_password text, p_answers jsonb,
  p_respondent text default null, p_meta jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f   public.forms%rowtype;
  r   public.responses%rowtype;
begin
  select * into f from public.forms where slug = p_slug;
  if not found           then return jsonb_build_object('ok', false, 'reason', 'missing'); end if;
  if f.status <> 'published' then return jsonb_build_object('ok', false, 'reason', f.status); end if;
  if coalesce(f.password,'') <> ''
     and f.password <> coalesce(p_password,'')
                         then return jsonb_build_object('ok', false, 'reason', 'password'); end if;

  -- Documento vivo: reescreve a resposta existente em vez de criar outra.
  if f.allow_edit then
    select * into r from public.responses
      where form_id = f.id order by submitted_at desc limit 1;
    if found then
      update public.responses
         set answers    = coalesce(p_answers, '[]'::jsonb),
             respondent = coalesce(nullif(p_respondent, ''), respondent),
             meta       = coalesce(p_meta, '{}'::jsonb),
             updated_at = now(),
             edits      = edits + 1
       where id = r.id;
      return jsonb_build_object('ok', true, 'mode', 'updated', 'edits', r.edits + 1);
    end if;
  end if;

  insert into public.responses (form_id, respondent, answers, meta)
  values (f.id, nullif(p_respondent, ''), coalesce(p_answers,'[]'::jsonb), coalesce(p_meta,'{}'::jsonb));

  return jsonb_build_object('ok', true, 'mode', 'created', 'edits', 0);
end $$;

grant execute on function public.form_public(text)                          to anon, authenticated;
grant execute on function public.form_unlock(text, text)                    to anon, authenticated;
grant execute on function public.form_submit(text, text, jsonb, text, jsonb) to anon, authenticated;

-- ── RLS ───────────────────────────────────────────────────────────

alter table public.forms     enable row level security;
alter table public.responses enable row level security;

-- Só quem está logado (Supabase Auth) enxerga e mexe nas tabelas.
-- A chave anon sozinha não lê nada daqui.
drop policy if exists forms_open     on public.forms;
drop policy if exists responses_open on public.responses;
drop policy if exists forms_team     on public.forms;
drop policy if exists responses_team on public.responses;

create policy forms_team     on public.forms     for all to authenticated using (true) with check (true);
create policy responses_team on public.responses for all to authenticated using (true) with check (true);

-- O link do cliente não precisa de login: ele só chama as três RPCs acima,
-- que são SECURITY DEFINER e por isso passam por cima da RLS — devolvendo
-- apenas o que o cliente pode ver, nunca a coluna `password`.
