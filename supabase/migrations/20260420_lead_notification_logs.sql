-- Lead notification delivery statuses per channel
create table if not exists public.lead_notification_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  channel text not null check (channel in ('telegram', 'email', 'whatsapp')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, channel)
);

create index if not exists idx_lead_notification_logs_lead_id on public.lead_notification_logs(lead_id);

alter table public.lead_notification_logs enable row level security;

create policy if not exists "service role manage lead_notification_logs"
  on public.lead_notification_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
