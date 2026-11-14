begin;

create function public.valid_stepwise_pricing_regions(regions jsonb)
returns boolean
language sql immutable strict
set search_path = ''
as $$
  select case when jsonb_typeof(regions) <> 'array' then false
    when jsonb_array_length(regions) not between 1 and 100 then false
    else (
      select count(*) = count(distinct item->>'code')
        and count(*) = count(distinct lower(btrim(item->>'name')))
        and bool_and(coalesce(
          jsonb_typeof(item) = 'object'
          and jsonb_typeof(item->'code') = 'string'
          and (item->>'code') ~ '^[a-z0-9_-]{1,80}$'
          and jsonb_typeof(item->'name') = 'string'
          and length(btrim(item->>'name')) between 1 and 80
          and case when jsonb_typeof(item->'turnkeyCoefficient') = 'number'
            then (item->>'turnkeyCoefficient')::numeric between 1 and 20 else false end,
          false
        ))
      from jsonb_array_elements(regions) as item
    )
  end;
$$;
revoke all on function public.valid_stepwise_pricing_regions(jsonb) from public, anon, authenticated;
grant execute on function public.valid_stepwise_pricing_regions(jsonb) to authenticated;

create table public.stepwise_pricing_settings (
  id smallint primary key check (id = 1),
  revision integer not null default 1 check (revision > 0),
  other_expenses_percent numeric(6,3) not null check (other_expenses_percent between 0 and 100),
  regions jsonb not null check (public.valid_stepwise_pricing_regions(regions))
);

insert into public.stepwise_pricing_settings (id, other_expenses_percent, regions)
values (1, 15.924, '[
  {"code":"tatarstan","name":"Татарстан","turnkeyCoefficient":2.7},
  {"code":"moscow","name":"Москва","turnkeyCoefficient":3}
]'::jsonb);

alter table public.stepwise_pricing_settings enable row level security;
revoke all on public.stepwise_pricing_settings from public, anon, authenticated;
grant select on public.stepwise_pricing_settings to anon, authenticated;
grant update (revision, other_expenses_percent, regions) on public.stepwise_pricing_settings to authenticated;

create policy "Read calculator pricing settings" on public.stepwise_pricing_settings
  for select to anon, authenticated using (true);
create policy "Pricing editors update calculator settings" on public.stepwise_pricing_settings
  for update to authenticated
  using ((select auth.jwt())->'app_metadata'->'calculator_pricing_admin' = 'true'::jsonb)
  with check ((select auth.jwt())->'app_metadata'->'calculator_pricing_admin' = 'true'::jsonb);

commit;
