-- Admin CRUD support for Quantity Engine catalogs and internal turnkey settings.

create table if not exists public.quantity_engine_settings (
  id text primary key default 'default',
  turnkey_coefficient numeric not null default 2.35 check (turnkey_coefficient >= 1),
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.quantity_engine_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quantity_engine_settings'
      and policyname = 'auth manage quantity_engine_settings'
  ) then
    create policy "auth manage quantity_engine_settings"
      on public.quantity_engine_settings for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'materials_catalog'
      and policyname = 'auth manage materials_catalog'
  ) then
    create policy "auth manage materials_catalog"
      on public.materials_catalog for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'railing_types'
      and policyname = 'auth manage railing_types'
  ) then
    create policy "auth manage railing_types"
      on public.railing_types for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

insert into public.quantity_engine_settings (id, turnkey_coefficient, notes)
values (
  'default',
  2.35,
  'Внутренний коэффициент цены под ключ для Quantity Engine.'
)
on conflict (id) do update set
  notes = coalesce(public.quantity_engine_settings.notes, excluded.notes),
  updated_at = now();
