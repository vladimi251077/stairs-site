-- Run in Supabase SQL editor
create extension if not exists "pgcrypto";

create table if not exists public.settings (
  id int primary key default 1,
  phone text,
  whatsapp text,
  telegram text,
  notify_email text,
  "heroTitle" text,
  "heroSubtitle" text,
  "heroImage" text,
  logo text,
  badge text,
  "baseRate" int default 5000,
  updated_at timestamptz default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order int default 1,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image text,
  price text,
  created_at timestamptz default now()
);

create table if not exists public.calculator_requests (
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

grant insert on table public.calculator_requests to anon;
grant insert, select, update, delete on table public.calculator_requests to authenticated;
grant all on table public.calculator_requests to service_role;

alter table public.settings enable row level security;
alter table public.services enable row level security;
alter table public.projects enable row level security;
alter table public.calculator_requests enable row level security;

create policy if not exists "public read settings" on public.settings for select using (true);
create policy if not exists "public read services" on public.services for select using (true);
create policy if not exists "public read projects" on public.projects for select using (true);

drop policy if exists "anon insert calculator_requests" on public.calculator_requests;
create policy "anon insert calculator_requests"
  on public.calculator_requests
  for insert
  to anon
  with check (true);

drop policy if exists "auth insert calculator_requests" on public.calculator_requests;
create policy "auth insert calculator_requests"
  on public.calculator_requests
  for insert
  to authenticated
  with check (true);

drop policy if exists "auth read calculator_requests" on public.calculator_requests;
create policy "auth read calculator_requests"
  on public.calculator_requests
  for select
  to authenticated
  using (true);

drop policy if exists "auth update calculator_requests" on public.calculator_requests;
create policy "auth update calculator_requests"
  on public.calculator_requests
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "auth delete calculator_requests" on public.calculator_requests;
create policy "auth delete calculator_requests"
  on public.calculator_requests
  for delete
  to authenticated
  using (true);

create policy if not exists "auth write settings" on public.settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists "auth write services" on public.services for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists "auth write projects" on public.projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into public.settings(id, phone, whatsapp, telegram, notify_email, "heroTitle", "heroSubtitle", "heroImage", logo, badge, "baseRate")
values (1, '+70000000000', '+70000000000', '@tekstura', null, 'Лестницы как арт-объект', 'Премиальные лестницы из дерева и металла для частных домов и вилл.', '/logo.jpg.png', '/logo.jpg.png', 'premium stairs brand', 5000)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy if not exists "public read assets" on storage.objects
for select using (bucket_id = 'site-assets');

create policy if not exists "auth upload assets" on storage.objects
for insert with check (bucket_id = 'site-assets' and auth.role() = 'authenticated');

create policy if not exists "auth update assets" on storage.objects
for update using (bucket_id = 'site-assets' and auth.role() = 'authenticated');


create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order int default 1,
  is_cover boolean default false,
  created_at timestamptz default now()
);

alter table public.projects add column if not exists cover_image text;
alter table public.projects add column if not exists custom_options jsonb not null default '{}'::jsonb;

alter table public.project_images enable row level security;
create policy if not exists "public read project_images" on public.project_images for select using (true);
create policy if not exists "auth write project_images" on public.project_images for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
