-- Align schema with current production pages (projects/project/request/admin)

alter table public.projects add column if not exists short_description text;
alter table public.projects add column if not exists full_description text;
alter table public.projects add column if not exists materials text;
alter table public.projects add column if not exists staircase_type text;
alter table public.projects add column if not exists category text;
alter table public.projects add column if not exists lead_time text;
alter table public.projects add column if not exists price_from numeric;

alter table public.project_images alter column sort_order set default 1;

create index if not exists idx_projects_created_at on public.projects(created_at desc);
create index if not exists idx_project_images_project_sort on public.project_images(project_id, sort_order asc);

alter table public.leads enable row level security;

drop policy if exists "auth insert leads" on public.leads;
create policy "auth insert leads" on public.leads
  for insert
  to authenticated
  with check (true);

drop policy if exists "auth update leads" on public.leads;
create policy "auth update leads" on public.leads
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "auth delete leads" on public.leads;
create policy "auth delete leads" on public.leads
  for delete
  to authenticated
  using (true);

-- keep request form compatibility
alter table public.calculator_requests add column if not exists messenger text;
alter table public.calculator_requests add column if not exists city text;
alter table public.calculator_requests add column if not exists comment text;
