create table if not exists public.materials_catalog (
  id text primary key,
  name text not null,
  unit text not null,
  base_rate numeric(12,2) not null default 0,
  consumable_rate numeric(12,2) not null default 0,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.railing_types (
  id text primary key,
  name text not null,
  price_per_meter numeric(12,2) not null default 0,
  description text,
  active boolean not null default true,
  visible_to_client boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.configuration_presets (
  id text primary key,
  mdf_sheets numeric(10,2) not null default 0,
  norms jsonb not null default '{}'::jsonb,
  addons jsonb not null default '{}'::jsonb,
  waste_percent numeric(6,2) not null default 0,
  complexity_factor numeric(8,3) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.materials_catalog (id, name, unit, base_rate, consumable_rate, active, sort_order)
values
  ('tube_16mm', 'Трубки 16 мм', 'm', 680, 54, true, 10),
  ('square_balusters', 'Квадратные балясины', 'pcs', 420, 34, true, 20),
  ('milled_balusters', 'Фрезерованные балясины', 'pcs', 670, 48, true, 30),
  ('glass', 'Стекло', 'm2', 5400, 280, true, 40),
  ('metal', 'Металл', 'm', 1800, 110, true, 50),
  ('wood', 'Дерево', 'm2', 8200, 330, true, 60),
  ('combined', 'Комбинированные', 'set', 9200, 500, true, 70)
on conflict (id) do update set
  name = excluded.name,
  unit = excluded.unit,
  base_rate = excluded.base_rate,
  consumable_rate = excluded.consumable_rate,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.railing_types (id, name, price_per_meter, description, active, visible_to_client, sort_order)
values
  ('tube_16mm', 'Трубки 16 мм', 9500, 'Вертикальные заполнения из трубки 16 мм.', true, true, 10),
  ('square_balusters', 'Квадратные балясины', 11200, 'Квадратные металлические балясины.', true, true, 20),
  ('milled_balusters', 'Фрезерованные балясины', 12800, 'Декоративные фрезерованные балясины.', true, true, 30),
  ('glass', 'Стекло', 18000, 'Закалённое стекло в ограждении.', true, true, 40),
  ('metal', 'Металл', 9800, 'Металлическое ограждение.', true, true, 50),
  ('wood', 'Дерево', 12500, 'Деревянное ограждение.', true, true, 60),
  ('combined', 'Комбинированные', 14500, 'Комбинация металла, дерева и/или стекла.', true, true, 70)
on conflict (id) do update set
  name = excluded.name,
  price_per_meter = excluded.price_per_meter,
  description = excluded.description,
  active = excluded.active,
  visible_to_client = excluded.visible_to_client,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.configuration_presets (id, mdf_sheets, norms, addons, waste_percent, complexity_factor)
values
  ('straight', 1.3, '{"metalPerStep":0.4}'::jsonb, '{}'::jsonb, 10, 1.0),
  ('L', 1.55, '{"metalPerStep":0.45}'::jsonb, '{"turnNode":1}'::jsonb, 12, 1.1),
  ('U', 1.8, '{"metalPerStep":0.5}'::jsonb, '{"turnNodes":2}'::jsonb, 14, 1.18),
  ('platform', 1.7, '{"metalPerStep":0.46}'::jsonb, '{"platform":1}'::jsonb, 12, 1.12),
  ('winder', 1.85, '{"metalPerStep":0.52}'::jsonb, '{"winderSet":1}'::jsonb, 15, 1.2),
  ('concrete', 0.95, '{"claddingPerM2":1}'::jsonb, '{"prep":1}'::jsonb, 11, 1.08),
  ('metal_frame', 1.1, '{"finishPerM2":1}'::jsonb, '{"fitCheck":1}'::jsonb, 10, 1.06)
on conflict (id) do update set
  mdf_sheets = excluded.mdf_sheets,
  norms = excluded.norms,
  addons = excluded.addons,
  waste_percent = excluded.waste_percent,
  complexity_factor = excluded.complexity_factor,
  updated_at = now();
