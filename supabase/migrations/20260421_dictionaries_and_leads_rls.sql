create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text not null,
  messenger text,
  city text,
  comment text,
  staircase_type text,
  dimensions_json jsonb not null default '{}'::jsonb,
  materials_json jsonb not null default '{}'::jsonb,
  options_json jsonb not null default '{}'::jsonb,
  calculated_price numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
drop policy if exists "anon insert leads" on public.leads;
create policy "anon insert leads" on public.leads for insert to anon with check (true);
drop policy if exists "auth read leads" on public.leads;
create policy "auth read leads" on public.leads for select to authenticated using (true);

create table if not exists public.stair_frame_materials (
  code text primary key,
  label text not null,
  price_delta int not null default 0,
  sort_order int not null default 1
);
create table if not exists public.stair_cladding_options (
  code text primary key,
  label text not null,
  price_delta int not null default 0,
  sort_order int not null default 1
);
create table if not exists public.stair_railing_options (
  code text primary key,
  label text not null,
  price_delta int not null default 0,
  sort_order int not null default 1
);
create table if not exists public.stair_finish_levels (
  code text primary key,
  label text not null,
  price_delta int not null default 0,
  sort_order int not null default 1
);

insert into public.stair_frame_materials(code,label,price_delta,sort_order) values
  ('metal','Металлокаркас',0,1),
  ('concrete','Бетонный каркас',42000,2),
  ('wood','Деревянный каркас',26000,3)
on conflict (code) do update set label=excluded.label, price_delta=excluded.price_delta, sort_order=excluded.sort_order;

insert into public.stair_cladding_options(code,label,price_delta,sort_order) values
  ('none','Без облицовки',-30000,1),
  ('standard','Стандарт',0,2),
  ('premium','Премиум',52000,3)
on conflict (code) do nothing;

insert into public.stair_railing_options(code,label,price_delta,sort_order) values
  ('none','Без ограждения',0,1),
  ('metal','Металл',0,2),
  ('glass','Стекло',38000,3),
  ('wood','Дерево',21000,4)
on conflict (code) do nothing;

insert into public.stair_finish_levels(code,label,price_delta,sort_order) values
  ('basic','Базовый',0,1),
  ('standard','Стандарт',18000,2),
  ('premium','Премиум',48000,3)
on conflict (code) do nothing;

alter table public.stair_frame_materials enable row level security;
alter table public.stair_cladding_options enable row level security;
alter table public.stair_railing_options enable row level security;
alter table public.stair_finish_levels enable row level security;

create policy if not exists "public read stair_frame_materials" on public.stair_frame_materials for select using (true);
create policy if not exists "public read stair_cladding_options" on public.stair_cladding_options for select using (true);
create policy if not exists "public read stair_railing_options" on public.stair_railing_options for select using (true);
create policy if not exists "public read stair_finish_levels" on public.stair_finish_levels for select using (true);
