alter table public.measurement_sessions
    add column if not exists garment_photo_paths text[] not null default '{}',
    add column if not exists style_photo_paths text[] not null default '{}';

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'measurement_sessions_garment_photo_limit'
          and conrelid = 'public.measurement_sessions'::regclass
    ) then
        alter table public.measurement_sessions
            add constraint measurement_sessions_garment_photo_limit
            check (cardinality(garment_photo_paths) <= 2);
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'measurement_sessions_style_photo_limit'
          and conrelid = 'public.measurement_sessions'::regclass
    ) then
        alter table public.measurement_sessions
            add constraint measurement_sessions_style_photo_limit
            check (cardinality(style_photo_paths) <= 3);
    end if;
end $$;
