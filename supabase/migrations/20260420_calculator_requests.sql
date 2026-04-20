-- Public lead form requests from calculator/request pages
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

create index if not exists idx_calculator_requests_created_at on public.calculator_requests(created_at desc);
create index if not exists idx_calculator_requests_phone on public.calculator_requests(phone);

alter table public.calculator_requests enable row level security;

drop policy if exists "anon insert calculator_requests" on public.calculator_requests;
create policy "anon insert calculator_requests"
  on public.calculator_requests
  for insert
  with check (true);

drop policy if exists "auth read calculator_requests" on public.calculator_requests;
create policy "auth read calculator_requests"
  on public.calculator_requests
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "auth update calculator_requests" on public.calculator_requests;
create policy "auth update calculator_requests"
  on public.calculator_requests
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "auth delete calculator_requests" on public.calculator_requests;
create policy "auth delete calculator_requests"
  on public.calculator_requests
  for delete
  using (auth.role() = 'authenticated');
