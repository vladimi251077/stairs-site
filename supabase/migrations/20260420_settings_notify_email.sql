alter table if exists public.settings
  add column if not exists notify_email text;
