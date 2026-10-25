create table if not exists public.cloth_gallery_items (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null check (kind in ('fabric', 'style')),
  category text not null,
  color text not null,
  pattern text not null,
  details text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloth_gallery_items_owner_created_idx
  on public.cloth_gallery_items (owner_id, created_at desc);

alter table public.cloth_gallery_items enable row level security;

grant select, insert, update, delete on public.cloth_gallery_items to authenticated;

drop policy if exists owners_manage_cloth_gallery_items on public.cloth_gallery_items;
create policy owners_manage_cloth_gallery_items on public.cloth_gallery_items
for all to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and (select public.is_active_shop_owner())
)
with check (
  owner_id = (select public.current_shop_owner_id())
  and (select public.is_active_shop_owner())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cloth-gallery', 'cloth-gallery', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists owners_manage_cloth_gallery_photos on storage.objects;
create policy owners_manage_cloth_gallery_photos on storage.objects
for all to authenticated
using (
  bucket_id = 'cloth-gallery'
  and (select public.is_active_shop_owner())
  and (storage.foldername(name))[1] = (select public.current_shop_owner_id())::text
)
with check (
  bucket_id = 'cloth-gallery'
  and (select public.is_active_shop_owner())
  and (storage.foldername(name))[1] = (select public.current_shop_owner_id())::text
);
