-- Run in Supabase SQL editor
create extension if not exists "pgcrypto";

create table if not exists public.settings (
  id int primary key default 1,
  phone text,
  whatsapp text,
  telegram text,
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

alter table public.settings enable row level security;
alter table public.services enable row level security;
alter table public.projects enable row level security;

create policy if not exists "public read settings" on public.settings for select using (true);
create policy if not exists "public read services" on public.services for select using (true);
create policy if not exists "public read projects" on public.projects for select using (true);

create policy if not exists "auth write settings" on public.settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists "auth write services" on public.services for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists "auth write projects" on public.projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into public.settings(id, phone, whatsapp, telegram, "heroTitle", "heroSubtitle", "heroImage", logo, badge, "baseRate")
values (1, '+70000000000', '+70000000000', '@tekstura', 'Лестницы как арт-объект', 'Премиальные лестницы из дерева и металла для частных домов и вилл.', '/logo.jpg.png', '/logo.jpg.png', 'premium stairs brand', 5000)
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
