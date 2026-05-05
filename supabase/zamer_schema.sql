-- Tekstura Замеры: первая схема Supabase
-- Запускать в Supabase SQL Editor.
-- Важно: сначала проверьте, что вы в правильном проекте Supabase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'zamer' check (role in ('admin','zamer','constructor','manager','viewer')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone2 text,
  address text not null,
  city text not null default 'Казань',
  source text,
  comment text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  client_id uuid references public.clients(id) on delete set null,
  created_by uuid references public.profiles(id),
  measurer_id uuid references public.profiles(id),
  checked_by uuid references public.profiles(id),

  status text not null default 'Черновик' check (status in ('Новый','Черновик','На проверке','Нужны уточнения','Готовый замер','Передан в расчёт','Смета готова','Заказ принят','Архив','Удалён')),
  priority text not null default 'Обычный' check (priority in ('Низкий','Обычный','Срочный')),

  object_type text not null default 'Частный дом',
  object_stage text not null default 'Черновая',
  site_situation text not null default 'Пустой проём',
  opening_type text not null default 'Прямой',
  stair_direction text,
  turn_side text,
  turn_type text,

  height_clean_to_clean_mm integer,
  height_rough_to_rough_mm integer,
  floor_finish_1_mm integer,
  floor_finish_2_mm integer,
  slab_thickness_mm integer,
  ceiling_height_1_mm integer,
  ceiling_height_2_mm integer,
  opening_length_mm integer,
  opening_width_mm integer,
  available_stair_length_mm integer,
  desired_flight_width_mm integer,

  flight1_length_mm integer,
  flight1_width_mm integer,
  flight2_length_mm integer,
  flight2_width_mm integer,
  corner_zone_length_mm integer,
  corner_zone_width_mm integer,
  landing_length_mm integer,
  landing_width_mm integer,
  winder_steps_count integer,

  wall_material text,
  slab_material text,
  can_fix_to_walls text,
  can_fix_to_slab text,
  has_warm_floor text default 'Не знаю',
  has_pipes boolean default false,
  has_electricity boolean default false,
  has_ventilation boolean default false,
  obstacles_comment text,

  frame_type text,
  step_material text,
  railing_type text,
  riser_needed text,
  side_panels_needed text,
  lighting_needed text,
  finish_comment text,

  general_comment text,
  check_comment text,
  checked_at timestamptz,

  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id),
  archive_file_url text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  delete_comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.measurement_photos (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.measurements(id) on delete cascade,
  photo_type text not null,
  file_path text not null,
  file_url text,
  comment text,
  is_required boolean not null default false,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.measurement_comments (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.measurements(id) on delete cascade,
  author_id uuid references public.profiles(id),
  comment_type text not null default 'Комментарий',
  text text not null,
  voice_file_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.measurements(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.stair_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_situation text not null,
  opening_type text not null,
  stair_type text not null,
  turn_side text,
  required_photos text[] default '{}',
  required_fields text[] default '{}',
  help_text text,
  active boolean not null default true,
  sort_order integer not null default 100
);

insert into public.stair_templates (name, site_situation, opening_type, stair_type, turn_side, required_photos, sort_order)
values
('Пустой прямой проём', 'Пустой проём', 'Прямой', 'Прямая', null, array['Общий вид снизу','Проём снизу','Проём сверху','Место старта','Место выхода'], 10),
('Пустой Г-образный левый проём', 'Пустой проём', 'Г-образный левый', 'Г-образная', 'Левый', array['Общий вид снизу','Проём снизу','Проём сверху','Место старта','Место выхода','Угловая зона'], 20),
('Пустой Г-образный правый проём', 'Пустой проём', 'Г-образный правый', 'Г-образная', 'Правый', array['Общий вид снизу','Проём снизу','Проём сверху','Место старта','Место выхода','Угловая зона'], 30),
('Пустой П-образный проём', 'Пустой проём', 'П-образный', 'П-образная', null, array['Общий вид снизу','Проём сверху','Первый марш','Разворот','Второй марш'], 40),
('Готовый металлокаркас', 'Готовый металлокаркас', 'Сложный / нестандартный', 'Обшивка каркаса', null, array['Каркас снизу','Каркас сверху','Крепление к полу','Крепление к перекрытию'], 50),
('Бетонная лестница', 'Бетонная лестница', 'Сложный / нестандартный', 'Обшивка бетона', null, array['Общий вид снизу','Общий вид сверху','Ступени крупно','Неровности'], 60)
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function public.can_read_measurement(m public.measurements)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and (
          p.role in ('constructor','manager','viewer')
          or m.created_by = auth.uid()
          or m.measurer_id = auth.uid()
        )
    );
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.measurements enable row level security;
alter table public.measurement_photos enable row level security;
alter table public.measurement_comments enable row level security;
alter table public.status_history enable row level security;
alter table public.stair_templates enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_admin" on public.profiles for insert with check (public.is_admin() or id = auth.uid());
create policy "profiles_update_own_or_admin" on public.profiles for update using (id = auth.uid() or public.is_admin());

create policy "clients_read" on public.clients for select using (public.is_admin() or created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('constructor','manager','viewer')));
create policy "clients_insert" on public.clients for insert with check (created_by = auth.uid() or public.is_admin());
create policy "clients_update" on public.clients for update using (created_by = auth.uid() or public.is_admin());

create policy "measurements_read" on public.measurements for select using (public.can_read_measurement(measurements));
create policy "measurements_insert" on public.measurements for insert with check (created_by = auth.uid() or public.is_admin());
create policy "measurements_update" on public.measurements for update using (public.can_read_measurement(measurements));

create policy "photos_read" on public.measurement_photos for select using (exists (select 1 from public.measurements m where m.id = measurement_id and public.can_read_measurement(m)));
create policy "photos_insert" on public.measurement_photos for insert with check (added_by = auth.uid() or public.is_admin());
create policy "photos_delete_admin" on public.measurement_photos for delete using (public.is_admin());

create policy "comments_read" on public.measurement_comments for select using (exists (select 1 from public.measurements m where m.id = measurement_id and public.can_read_measurement(m)));
create policy "comments_insert" on public.measurement_comments for insert with check (author_id = auth.uid() or public.is_admin());

create policy "history_read" on public.status_history for select using (exists (select 1 from public.measurements m where m.id = measurement_id and public.can_read_measurement(m)));
create policy "history_insert" on public.status_history for insert with check (changed_by = auth.uid() or public.is_admin());

create policy "templates_read" on public.stair_templates for select using (true);
create policy "templates_admin_write" on public.stair_templates for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('measurement-photos', 'measurement-photos', false)
on conflict (id) do nothing;

create policy "storage_measurement_photos_read" on storage.objects for select
using (bucket_id = 'measurement-photos' and auth.role() = 'authenticated');

create policy "storage_measurement_photos_insert" on storage.objects for insert
with check (bucket_id = 'measurement-photos' and auth.role() = 'authenticated');

create policy "storage_measurement_photos_delete_admin" on storage.objects for delete
using (bucket_id = 'measurement-photos' and public.is_admin());
