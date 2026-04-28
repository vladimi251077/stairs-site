-- Normalize settings table to canonical singleton row id=1.
do $$
declare
  canonical_exists boolean;
begin
  select exists(select 1 from public.settings where id = 1) into canonical_exists;

  if not canonical_exists then
    insert into public.settings (id, updated_at, "baseRate")
    values (1, now(), null);
  end if;

  with latest as (
    select
      (select nullif(trim(s.phone), '') from public.settings s where nullif(trim(s.phone), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as phone,
      (select nullif(trim(s.whatsapp), '') from public.settings s where nullif(trim(s.whatsapp), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as whatsapp,
      (select nullif(trim(s.telegram), '') from public.settings s where nullif(trim(s.telegram), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as telegram,
      (select nullif(trim(s.notify_email), '') from public.settings s where nullif(trim(s.notify_email), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as notify_email,
      (select nullif(trim(s."heroTitle"), '') from public.settings s where nullif(trim(s."heroTitle"), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as "heroTitle",
      (select nullif(trim(s."heroSubtitle"), '') from public.settings s where nullif(trim(s."heroSubtitle"), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as "heroSubtitle",
      (select nullif(trim(s."heroImage"), '') from public.settings s where nullif(trim(s."heroImage"), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as "heroImage",
      (select nullif(trim(s.logo), '') from public.settings s where nullif(trim(s.logo), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as logo,
      (select nullif(trim(s.badge), '') from public.settings s where nullif(trim(s.badge), '') is not null order by s.updated_at desc nulls last, s.id desc limit 1) as badge,
      (select s."baseRate" from public.settings s where s."baseRate" is not null order by s.updated_at desc nulls last, s.id desc limit 1) as "baseRate"
  )
  update public.settings as canonical
  set
    phone = coalesce(latest.phone, canonical.phone),
    whatsapp = coalesce(latest.whatsapp, canonical.whatsapp),
    telegram = coalesce(latest.telegram, canonical.telegram),
    notify_email = coalesce(latest.notify_email, canonical.notify_email),
    "heroTitle" = coalesce(latest."heroTitle", canonical."heroTitle"),
    "heroSubtitle" = coalesce(latest."heroSubtitle", canonical."heroSubtitle"),
    "heroImage" = coalesce(latest."heroImage", canonical."heroImage"),
    logo = coalesce(latest.logo, canonical.logo),
    badge = coalesce(latest.badge, canonical.badge),
    "baseRate" = coalesce(latest."baseRate", canonical."baseRate"),
    updated_at = now()
  from latest
  where canonical.id = 1;

  delete from public.settings
  where id <> 1;
end $$;

alter table public.settings
  drop constraint if exists settings_singleton_id_check;

alter table public.settings
  add constraint settings_singleton_id_check check (id = 1);
