-- Allow the public calculator to read only the default Quantity Engine runtime settings row.

alter table public.quantity_engine_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quantity_engine_settings'
      and policyname = 'public read default quantity_engine_settings'
  ) then
    create policy "public read default quantity_engine_settings"
      on public.quantity_engine_settings
      for select
      using (id = 'default');
  end if;
end $$;
