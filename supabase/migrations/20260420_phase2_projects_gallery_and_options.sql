-- Phase 2: project gallery + mini-configurator compatibility
create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order int not null default 1,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.projects add column if not exists cover_image text;
alter table public.projects add column if not exists custom_options jsonb not null default '{}'::jsonb;

create index if not exists idx_project_images_project_id on public.project_images(project_id);
create index if not exists idx_project_images_cover on public.project_images(project_id, is_cover desc, sort_order asc);

alter table public.project_images enable row level security;
create policy if not exists "public read project_images" on public.project_images for select using (true);
create policy if not exists "auth write project_images" on public.project_images for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

update public.projects set cover_image = coalesce(cover_image, image) where cover_image is null;

insert into public.project_images (project_id, image_url, alt_text, sort_order, is_cover)
select p.id, coalesce(p.cover_image, p.image), p.title, 1, true
from public.projects p
where coalesce(p.cover_image, p.image) is not null
and not exists (select 1 from public.project_images pi where pi.project_id = p.id);
