-- Normalize settings table to canonical singleton row id=1.
do $$
declare
  canonical_exists boolean;
begin
  select exists(select 1 from public.settings where id = 1) into canonical_exists;

  if not canonical_exists then
    insert into public.settings (id, updated_at)
    values (1, now());
  end if;

  update public.settings as canonical
  set
    phone = coalesce(nullif(canonical.phone, ''), (
      select s.phone from public.settings s
      where s.id <> 1 and nullif(s.phone, '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    whatsapp = coalesce(nullif(canonical.whatsapp, ''), (
      select s.whatsapp from public.settings s
      where s.id <> 1 and nullif(s.whatsapp, '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    telegram = coalesce(nullif(canonical.telegram, ''), (
      select s.telegram from public.settings s
      where s.id <> 1 and nullif(s.telegram, '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    notify_email = coalesce(nullif(canonical.notify_email, ''), (
      select s.notify_email from public.settings s
      where s.id <> 1 and nullif(s.notify_email, '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    "heroTitle" = coalesce(nullif(canonical."heroTitle", ''), (
      select s."heroTitle" from public.settings s
      where s.id <> 1 and nullif(s."heroTitle", '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    "heroSubtitle" = coalesce(nullif(canonical."heroSubtitle", ''), (
      select s."heroSubtitle" from public.settings s
      where s.id <> 1 and nullif(s."heroSubtitle", '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    "heroImage" = coalesce(nullif(canonical."heroImage", ''), (
      select s."heroImage" from public.settings s
      where s.id <> 1 and nullif(s."heroImage", '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    logo = coalesce(nullif(canonical.logo, ''), (
      select s.logo from public.settings s
      where s.id <> 1 and nullif(s.logo, '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    badge = coalesce(nullif(canonical.badge, ''), (
      select s.badge from public.settings s
      where s.id <> 1 and nullif(s.badge, '') is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    "baseRate" = coalesce(canonical."baseRate", (
      select s."baseRate" from public.settings s
      where s.id <> 1 and s."baseRate" is not null
      order by s.updated_at desc nulls last
      limit 1
    )),
    updated_at = now()
  where canonical.id = 1;

  delete from public.settings
  where id <> 1;
end $$;

alter table public.settings
  drop constraint if exists settings_singleton_id_check;

alter table public.settings
  add constraint settings_singleton_id_check check (id = 1);
