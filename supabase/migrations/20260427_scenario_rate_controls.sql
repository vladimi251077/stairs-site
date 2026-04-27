-- Scenario pricing rules for stair calculator

create table if not exists public.stair_scenario_rates (
  id uuid primary key default gen_random_uuid(),
  rate_group text not null,
  rate_key text not null,
  label text not null,
  rate numeric not null default 0,
  sort_order int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

delete from public.stair_scenario_rates a
using public.stair_scenario_rates b
where a.ctid < b.ctid
  and a.rate_group = b.rate_group
  and a.rate_key = b.rate_key;

create unique index if not exists stair_scenario_rates_group_key_idx
on public.stair_scenario_rates (rate_group, rate_key);

alter table public.stair_scenario_rates enable row level security;

create policy if not exists "public read stair_scenario_rates"
on public.stair_scenario_rates
for select
using (true);

create policy if not exists "auth write stair_scenario_rates"
on public.stair_scenario_rates
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

insert into public.stair_scenario_rates (rate_group, rate_key, label, rate, sort_order, active)
values
  ('finishMaterialPerM2', 'oak', 'Дуб / шпон', 22000, 1, true),
  ('finishMaterialPerM2', 'ash', 'Ясень', 19000, 2, true),
  ('finishMaterialPerM2', 'stone', 'Камень', 34000, 3, true),
  ('finishMaterialPerM2', 'porcelain', 'Керамогранит', 17500, 4, true),
  ('finishMaterialPerM2', 'microcement', 'Микроцемент', 15500, 5, true),
  ('railingPerM', 'metal', 'Ограждение: металл', 9500, 10, true),
  ('railingPerM', 'glass', 'Ограждение: стекло', 18000, 11, true),
  ('railingPerM', 'wood', 'Ограждение: дерево', 12500, 12, true),
  ('railingPerM', 'none', 'Ограждение: не нужно', 0, 13, true),
  ('lightingPerStep', 'none', 'Подсветка: нет', 0, 20, true),
  ('lightingPerStep', 'step', 'Подсветка: точечная', 1400, 21, true),
  ('lightingPerStep', 'linear', 'Подсветка: линейная', 2100, 22, true),
  ('coatingPerM2', 'none', 'Покрытие: нет', 0, 30, true),
  ('coatingPerM2', 'standard', 'Покрытие: стандарт', 2200, 31, true),
  ('coatingPerM2', 'premium', 'Покрытие: премиум', 3600, 32, true),
  ('service', 'fitCheck', 'Проверка посадки каркаса', 15000, 40, true),
  ('service', 'prepPerM2', 'Подготовка основания за м²', 4200, 41, true),
  ('service', 'installPerM2', 'Монтаж отделки за м²', 5200, 42, true)
on conflict (rate_group, rate_key) do update
set
  label = excluded.label,
  rate = excluded.rate,
  sort_order = excluded.sort_order,
  active = excluded.active;
