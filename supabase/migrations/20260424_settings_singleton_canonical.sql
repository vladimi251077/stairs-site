-- Normalize settings table to a canonical singleton row (id = 1)

-- Merge all rows into id=1, preferring non-empty values from the most recently updated rows.
with ranked as (
  select
    id,
    phone,
    whatsapp,
    telegram,
    notify_email,
    max,
    "heroTitle",
    "heroSubtitle",
    "heroImage",
    logo,
    badge,
    "baseRate",
    updated_at,
    row_number() over (order by updated_at desc nulls last, id desc) as rn
  from public.settings
),
merged as (
  select
    coalesce(
      (select nullif(trim(notify_email), '') from ranked where nullif(trim(notify_email), '') is not null order by rn limit 1),
      null
    ) as notify_email,
    (select phone from ranked where nullif(trim(phone), '') is not null order by rn limit 1) as phone,
    (select whatsapp from ranked where nullif(trim(whatsapp), '') is not null order by rn limit 1) as whatsapp,
    (select telegram from ranked where nullif(trim(telegram), '') is not null order by rn limit 1) as telegram,
    (select max from ranked where nullif(trim(max), '') is not null order by rn limit 1) as max,
    (select "heroTitle" from ranked where nullif(trim("heroTitle"), '') is not null order by rn limit 1) as "heroTitle",
    (select "heroSubtitle" from ranked where nullif(trim("heroSubtitle"), '') is not null order by rn limit 1) as "heroSubtitle",
    (select "heroImage" from ranked where nullif(trim("heroImage"), '') is not null order by rn limit 1) as "heroImage",
    (select logo from ranked where nullif(trim(logo), '') is not null order by rn limit 1) as logo,
    (select badge from ranked where nullif(trim(badge), '') is not null order by rn limit 1) as badge,
    (select "baseRate" from ranked where "baseRate" is not null order by rn limit 1) as "baseRate"
)
insert into public.settings (
  id, phone, whatsapp, telegram, notify_email, max,
  "heroTitle", "heroSubtitle", "heroImage", logo, badge, "baseRate", updated_at
)
select
  1,
  merged.phone,
  merged.whatsapp,
  merged.telegram,
  merged.notify_email,
  merged.max,
  merged."heroTitle",
  merged."heroSubtitle",
  merged."heroImage",
  merged.logo,
  merged.badge,
  coalesce(merged."baseRate", 5000),
  now()
from merged
on conflict (id) do update
set
  phone = excluded.phone,
  whatsapp = excluded.whatsapp,
  telegram = excluded.telegram,
  notify_email = excluded.notify_email,
  max = excluded.max,
  "heroTitle" = excluded."heroTitle",
  "heroSubtitle" = excluded."heroSubtitle",
  "heroImage" = excluded."heroImage",
  logo = excluded.logo,
  badge = excluded.badge,
  "baseRate" = excluded."baseRate",
  updated_at = now();

-- Delete any non-canonical rows to avoid admin/API desynchronization.
delete from public.settings where id <> 1;

-- Guard against future inserts/updates for ids other than 1.
drop trigger if exists trg_settings_singleton_guard on public.settings;
drop function if exists public.enforce_settings_singleton();

create function public.enforce_settings_singleton()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from 1 then
    raise exception 'settings is singleton: only id=1 is allowed';
  end if;
  return new;
end;
$$;

create trigger trg_settings_singleton_guard
before insert or update on public.settings
for each row
execute function public.enforce_settings_singleton();
