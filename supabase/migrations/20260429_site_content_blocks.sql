create table if not exists public.site_content_blocks (
  page_key text not null,
  block_key text not null,
  title text,
  description text,
  content jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  sort_order int not null default 100,
  updated_at timestamptz default now(),
  primary key (page_key, block_key)
);

alter table public.site_content_blocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'site_content_blocks' and policyname = 'site_content_blocks_public_read'
  ) then
    create policy site_content_blocks_public_read on public.site_content_blocks
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'site_content_blocks' and policyname = 'site_content_blocks_auth_write'
  ) then
    create policy site_content_blocks_auth_write on public.site_content_blocks
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;
