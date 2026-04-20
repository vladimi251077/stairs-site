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

grant insert on table public.calculator_requests to anon;
grant insert, select, update, delete on table public.calculator_requests to authenticated;
grant all on table public.calculator_requests to service_role;

create index if not exists idx_calculator_requests_created_at on public.calculator_requests(created_at desc);
create index if not exists idx_calculator_requests_phone on public.calculator_requests(phone);

alter table public.calculator_requests enable row level security;

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
