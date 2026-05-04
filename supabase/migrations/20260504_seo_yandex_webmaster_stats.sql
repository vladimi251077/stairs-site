-- SEO / Yandex Webmaster statistics storage for Tekstura admin
-- Run this migration in Supabase SQL Editor or through your normal migration flow.

create extension if not exists pgcrypto;

create table if not exists public.seo_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  source text not null default 'yandex_webmaster',
  period_start date,
  period_end date,
  rows_imported integer not null default 0,
  message text,
  totals jsonb not null default '{}'::jsonb
);

create table if not exists public.seo_query_stats (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'yandex_webmaster',
  period_start date not null,
  period_end date not null,
  imported_at timestamptz not null default now(),
  query text not null,
  query_id text,
  url text,
  device_type text not null default 'ALL',
  region text,
  shows integer not null default 0,
  clicks integer not null default 0,
  ctr numeric generated always as (
    case when shows > 0 then round((clicks::numeric / shows::numeric) * 100, 2) else 0 end
  ) stored,
  avg_show_position numeric,
  avg_click_position numeric,
  raw jsonb not null default '{}'::jsonb
);

create unique index if not exists seo_query_stats_unique_period_query
  on public.seo_query_stats (source, period_start, period_end, device_type, query, coalesce(url, ''));

create index if not exists seo_query_stats_period_idx on public.seo_query_stats (period_end desc, period_start desc);
create index if not exists seo_query_stats_query_idx on public.seo_query_stats using gin (to_tsvector('simple', query));

create table if not exists public.seo_tracked_queries (
  id uuid primary key default gen_random_uuid(),
  query text not null unique,
  group_name text not null default 'Деревянные лестницы Казань',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into public.seo_tracked_queries (query, group_name, sort_order)
values
  ('деревянные лестницы казань', 'Деревянные лестницы Казань', 10),
  ('деревянные лестницы на заказ казань', 'Деревянные лестницы Казань', 20),
  ('лестницы из дерева казань', 'Деревянные лестницы Казань', 30),
  ('лестница деревянная на второй этаж казань', 'Деревянные лестницы Казань', 40),
  ('изготовление деревянных лестниц казань', 'Деревянные лестницы Казань', 50),
  ('деревянная лестница под ключ казань', 'Деревянные лестницы Казань', 60),
  ('обшивка лестницы деревом казань', 'Обшивка каркаса', 70),
  ('обшивка каркаса лестницы деревом', 'Обшивка каркаса', 80),
  ('обшивка готового каркаса лестницы', 'Обшивка каркаса', 90),
  ('обшивка бетонной лестницы деревом', 'Обшивка каркаса', 100),
  ('обшивка металлического каркаса лестницы деревом', 'Обшивка каркаса', 110),
  ('отделка лестницы деревом казань', 'Обшивка каркаса', 120),
  ('облицовка лестницы деревом казань', 'Обшивка каркаса', 130),
  ('деревянные ступени на заказ казань', 'Ступени', 140),
  ('ступени из дерева казань', 'Ступени', 150),
  ('ступени на металлический каркас', 'Ступени', 160),
  ('ступени на бетонную лестницу', 'Ступени', 170)
on conflict (query) do update set
  group_name = excluded.group_name,
  sort_order = excluded.sort_order,
  active = true;

alter table public.seo_sync_runs enable row level security;
alter table public.seo_query_stats enable row level security;
alter table public.seo_tracked_queries enable row level security;

-- Admin UI reads these tables through Netlify Functions with service role key.
-- No public RLS policies are created intentionally.