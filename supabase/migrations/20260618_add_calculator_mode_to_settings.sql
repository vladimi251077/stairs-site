alter table public.settings
  add column if not exists calculator_mode text;

update public.settings
set calculator_mode = 'production'
where calculator_mode is null
   or calculator_mode not in ('production', 'maintenance', 'preview');

alter table public.settings
  alter column calculator_mode set default 'production',
  alter column calculator_mode set not null;

alter table public.settings
  drop constraint if exists settings_calculator_mode_check;

alter table public.settings
  add constraint settings_calculator_mode_check
  check (calculator_mode in ('production', 'maintenance', 'preview'));
