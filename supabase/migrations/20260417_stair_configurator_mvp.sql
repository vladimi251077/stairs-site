-- Stair Configurator MVP dictionaries and calculation storage
create table if not exists public.stair_defaults (
  id uuid primary key default gen_random_uuid(),
  labor_rate_per_step numeric not null default 2500,
  metal_rate_per_meter numeric not null default 1800,
  wood_rate_per_m2 numeric not null default 16000,
  concrete_rate_per_m3 numeric not null default 14000,
  install_coef numeric not null default 1.12,
  markup_coef numeric not null default 1.08,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stair_configs (
  id uuid primary key default gen_random_uuid(),
  opening_type text not null check (opening_type in ('straight', 'l_turn', 'u_turn')),
  stair_type text not null check (stair_type in ('straight', 'l_turn', 'u_turn')),
  turn_direction text check (turn_direction in ('left', 'right')),
  turn_type text check (turn_type in ('landing', 'winders')),
  floor_to_floor_height numeric not null,
  opening_length numeric not null,
  opening_width numeric,
  march_width numeric not null,
  frame_material text not null check (frame_material in ('metal', 'wood', 'concrete')),
  finish_level text not null default 'basic',
  created_at timestamptz not null default now()
);

create table if not exists public.stair_material_rules (
  id uuid primary key default gen_random_uuid(),
  frame_material text not null check (frame_material in ('metal', 'wood', 'concrete')),
  metric_key text not null,
  unit text not null,
  rate numeric not null,
  waste_percent numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stair_step_materials (
  id uuid primary key default gen_random_uuid(),
  frame_material text not null check (frame_material in ('metal', 'wood', 'concrete')),
  material_name text not null,
  default_thickness_mm numeric,
  default_consumption numeric,
  unit text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stair_railing_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_per_meter numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stair_calculations (
  id uuid primary key default gen_random_uuid(),
  stair_config_id uuid references public.stair_configs(id) on delete set null,
  geometry jsonb not null,
  materials jsonb not null,
  price jsonb not null,
  status text not null,
  warnings jsonb,
  created_at timestamptz not null default now()
);

alter table public.stair_defaults enable row level security;
alter table public.stair_configs enable row level security;
alter table public.stair_material_rules enable row level security;
alter table public.stair_step_materials enable row level security;
alter table public.stair_railing_types enable row level security;
alter table public.stair_calculations enable row level security;

create policy if not exists "public read stair_defaults" on public.stair_defaults for select using (true);
create policy if not exists "public read stair_material_rules" on public.stair_material_rules for select using (true);
create policy if not exists "public read stair_step_materials" on public.stair_step_materials for select using (true);
create policy if not exists "public read stair_railing_types" on public.stair_railing_types for select using (true);

create policy if not exists "anon insert stair_calculations" on public.stair_calculations for insert with check (true);
create policy if not exists "anon insert stair_configs" on public.stair_configs for insert with check (true);

insert into public.stair_defaults (
  labor_rate_per_step,
  metal_rate_per_meter,
  wood_rate_per_m2,
  concrete_rate_per_m3,
  install_coef,
  markup_coef,
  active
) values (2500, 1800, 16000, 14000, 1.12, 1.08, true)
on conflict do nothing;

insert into public.stair_railing_types (code, name, price_per_meter, active)
values
  ('minimal_metal', 'Минималистичное металл', 9500, true),
  ('glass', 'Стекло на стойках', 18000, true),
  ('wood_classic', 'Классическое дерево', 12500, true)
on conflict (code) do nothing;
