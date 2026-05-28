-- Quantity Engine architecture seed: catalogs, railing types, and configuration presets.
-- Client price is intentionally modeled as material/consumable subtotal multiplied by one turnkey coefficient.

create table if not exists public.materials_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  category text not null check (category in ('MDF', 'дуб', 'ясень', 'эмаль', 'лак', 'грунт', 'расходники', 'доборы', 'металл', 'стекло')),
  base_cost numeric not null default 0 check (base_cost >= 0),
  waste_percent numeric not null default 0 check (waste_percent >= 0),
  active boolean not null default true,
  visible_to_client boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.railing_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_per_meter numeric not null default 0 check (price_per_meter >= 0),
  description text,
  active boolean not null default true,
  visible_to_client boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.configuration_presets (
  id uuid primary key default gen_random_uuid(),
  type text not null unique check (type in ('straight', 'L', 'U', 'platform', 'winder', 'concrete', 'metal_frame')),
  internal_key text not null unique,
  display_name text not null,
  mdf_sheet_norms jsonb not null default '{}'::jsonb,
  addons jsonb not null default '{}'::jsonb,
  waste_percent numeric not null default 0 check (waste_percent >= 0),
  complexity_factor numeric not null default 1 check (complexity_factor > 0),
  railing_defaults jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  visible_to_client boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.materials_catalog enable row level security;
alter table public.railing_types enable row level security;
alter table public.configuration_presets enable row level security;

create policy if not exists "public read active materials_catalog"
  on public.materials_catalog for select using (active = true);
create policy if not exists "public read active railing_types"
  on public.railing_types for select using (active = true);
create policy if not exists "public read active configuration_presets"
  on public.configuration_presets for select using (active = true);

-- MDF_36_SHEET is used for treads and platforms; MDF_10_SHEET is used for risers.
insert into public.materials_catalog (code, name, unit, category, base_cost, waste_percent, active, visible_to_client, sort_order)
values
  ('MDF_18_SHEET', 'MDF 18 мм, лист', 'sheet', 'MDF', 2500, 12, true, false, 10),
  ('MDF_36_SHEET', 'MDF 36 мм, лист', 'sheet', 'MDF', 5000, 12, true, false, 15),
  ('MDF_10_SHEET', 'MDF 10 мм, лист', 'sheet', 'MDF', 1700, 12, true, false, 20),
  ('OAK_TREAD_BLANK', 'Дуб, заготовка ступени', 'm2', 'дуб', 18500, 15, true, false, 30),
  ('ASH_TREAD_BLANK', 'Ясень, заготовка ступени', 'm2', 'ясень', 14500, 15, true, false, 40),
  ('ENAMEL_FINISH', 'Эмаль', 'l', 'эмаль', 1200, 8, true, false, 50),
  ('LACQUER_FINISH', 'Лак', 'l', 'лак', 1350, 8, true, false, 60),
  ('PRIMER_BASE', 'Грунт', 'l', 'грунт', 650, 8, true, false, 70),
  ('FASTENERS_BASIC', 'Крепёж', 'set', 'расходники', 900, 10, true, false, 80),
  ('ADHESIVE_BASIC', 'Клей монтажный', 'kg', 'расходники', 420, 8, true, false, 82),
  ('SEALANT_BASIC', 'Герметик', 'tube', 'расходники', 360, 8, true, false, 84),
  ('CONSUMABLE_KIT', 'Расходный набор', 'set', 'расходники', 650, 10, true, false, 86),
  ('ADDONS_TRIMS', 'Доборы и планки', 'm', 'доборы', 950, 10, true, false, 90),
  ('METAL_RAILING_PARTS', 'Металлические элементы ограждения', 'm', 'металл', 6200, 7, true, false, 100),
  ('GLASS_RAILING_PARTS', 'Стеклянные элементы ограждения', 'm', 'стекло', 12800, 7, true, false, 110)
on conflict (code) do update set
  name = excluded.name,
  unit = excluded.unit,
  category = excluded.category,
  base_cost = excluded.base_cost,
  waste_percent = excluded.waste_percent,
  active = excluded.active,
  visible_to_client = excluded.visible_to_client,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.railing_types (name, price_per_meter, description, active, visible_to_client, sort_order)
values
  ('трубки 16 мм', 9500, 'Лёгкое ограждение с горизонтальными трубками 16 мм.', true, true, 10),
  ('квадратные балясины', 11000, 'Ограждение с квадратными вертикальными балясинами.', true, true, 20),
  ('фрезерованные балясины', 14500, 'Деревянные фрезерованные балясины для классического вида.', true, true, 30),
  ('стекло', 18500, 'Стеклянное ограждение по выбранной длине лестницы.', true, true, 40),
  ('металл', 12500, 'Металлическое ограждение; верхняя балюстрада считается дополнительной длиной.', true, true, 50),
  ('дерево', 13500, 'Деревянное ограждение по маршу и верхней балюстраде.', true, true, 60),
  ('комбинированные', 16500, 'Комбинация дерева, металла или стекла в одном выбранном типе.', true, true, 70)
on conflict (name) do update set
  price_per_meter = excluded.price_per_meter,
  description = excluded.description,
  active = excluded.active,
  visible_to_client = excluded.visible_to_client,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.configuration_presets (
  type,
  internal_key,
  display_name,
  mdf_sheet_norms,
  addons,
  waste_percent,
  complexity_factor,
  railing_defaults,
  active,
  visible_to_client,
  sort_order
)
values
  ('straight', 'straight', 'Прямая лестница', '{"treadSheetFactor":0.18,"riserSheetFactor":0.08,"platformSheetFactor":0}'::jsonb, '{"shoesPerStep":1,"nosingPerStepM":1,"endTrimPerOpenSideM":0.45}'::jsonb, 10, 1.00, '{"enabled":true,"topBalustradeLengthM":0}'::jsonb, true, false, 10),
  ('L', 'L', 'Г-образная лестница', '{"treadSheetFactor":0.20,"riserSheetFactor":0.09,"platformSheetFactor":0.80}'::jsonb, '{"shoesPerStep":1,"nosingPerStepM":1,"endTrimPerOpenSideM":0.55}'::jsonb, 12, 1.12, '{"enabled":true,"topBalustradeLengthM":0.8}'::jsonb, true, false, 20),
  ('U', 'U', 'П-образная лестница', '{"treadSheetFactor":0.22,"riserSheetFactor":0.10,"platformSheetFactor":1.20}'::jsonb, '{"shoesPerStep":1,"nosingPerStepM":1,"endTrimPerOpenSideM":0.65}'::jsonb, 14, 1.20, '{"enabled":true,"topBalustradeLengthM":1.2}'::jsonb, true, false, 30),
  ('platform', 'platform', 'Лестница с площадкой', '{"treadSheetFactor":0.18,"riserSheetFactor":0.08,"platformSheetFactor":1.00}'::jsonb, '{"shoesPerStep":1,"nosingPerStepM":1,"endTrimPerOpenSideM":0.60}'::jsonb, 12, 1.10, '{"enabled":true,"topBalustradeLengthM":0.8}'::jsonb, true, false, 40),
  ('winder', 'winder', 'Лестница с забежными ступенями', '{"treadSheetFactor":0.24,"riserSheetFactor":0.10,"platformSheetFactor":0}'::jsonb, '{"shoesPerStep":1,"nosingPerStepM":1.08,"endTrimPerOpenSideM":0.70}'::jsonb, 16, 1.28, '{"enabled":true,"topBalustradeLengthM":1.0}'::jsonb, true, false, 50),
  ('concrete', 'concrete', 'Бетонное основание', '{"treadSheetFactor":0.16,"riserSheetFactor":0.08,"platformSheetFactor":0.80}'::jsonb, '{"shoesPerStep":0,"nosingPerStepM":1,"endTrimPerOpenSideM":0.50}'::jsonb, 11, 1.08, '{"enabled":true,"topBalustradeLengthM":0}'::jsonb, true, false, 60),
  ('metal_frame', 'metal_frame', 'Металлический каркас', '{"treadSheetFactor":0.20,"riserSheetFactor":0.08,"platformSheetFactor":0.90}'::jsonb, '{"shoesPerStep":1,"nosingPerStepM":1,"endTrimPerOpenSideM":0.60}'::jsonb, 13, 1.15, '{"enabled":true,"topBalustradeLengthM":0}'::jsonb, true, false, 70)
on conflict (type) do update set
  internal_key = excluded.internal_key,
  display_name = excluded.display_name,
  mdf_sheet_norms = excluded.mdf_sheet_norms,
  addons = excluded.addons,
  waste_percent = excluded.waste_percent,
  complexity_factor = excluded.complexity_factor,
  railing_defaults = excluded.railing_defaults,
  active = excluded.active,
  visible_to_client = excluded.visible_to_client,
  sort_order = excluded.sort_order,
  updated_at = now();
