-- Regional pricing controls for stair calculator

create table if not exists public.stair_pricing_regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_coef numeric not null default 1,
  notes text,
  sort_order int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stair_pricing_regions enable row level security;

create policy if not exists "public read stair_pricing_regions"
on public.stair_pricing_regions
for select
using (true);

create policy if not exists "auth write stair_defaults"
on public.stair_defaults
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy if not exists "auth write stair_material_rules"
on public.stair_material_rules
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy if not exists "auth write stair_step_materials"
on public.stair_step_materials
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy if not exists "auth write stair_railing_types"
on public.stair_railing_types
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy if not exists "auth write stair_pricing_regions"
on public.stair_pricing_regions
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

insert into public.stair_pricing_regions (code, name, price_coef, notes, sort_order, active)
values
  ('primary_region', 'Основной регион', 1, 'Базовый коэффициент без надбавки.', 1, true),
  ('secondary_region', 'Второй регион', 1, 'Скорректируйте коэффициент под второй регион.', 2, true)
on conflict (code) do update
set
  name = excluded.name,
  notes = excluded.notes,
  sort_order = excluded.sort_order,
  active = excluded.active;
