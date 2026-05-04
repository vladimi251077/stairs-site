create table if not exists public.seo_query_stats (
  id bigserial primary key,
  source text not null default 'yandex_webmaster',
  date_from date not null,
  date_to date not null,
  device text not null default 'ALL',
  query text not null,
  url text not null default '',
  shows integer not null default 0,
  clicks integer not null default 0,
  avg_position numeric,
  group_name text,
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (source, date_from, date_to, device, query, url)
);

create table if not exists public.seo_sync_runs (
  id bigserial primary key,
  source text not null default 'yandex_webmaster',
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  message text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.seo_tracked_queries (
  id bigserial primary key,
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

alter table public.seo_query_stats enable row level security;
alter table public.seo_sync_runs enable row level security;
alter table public.seo_tracked_queries enable row level security;

create policy if not exists "Authenticated admins can read seo query stats"
  on public.seo_query_stats for select
  to authenticated
  using (true);

create policy if not exists "Authenticated admins can read seo sync runs"
  on public.seo_sync_runs for select
  to authenticated
  using (true);

create policy if not exists "Authenticated admins can read seo tracked queries"
  on public.seo_tracked_queries for select
  to authenticated
  using (true);
