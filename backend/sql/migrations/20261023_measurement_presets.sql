create table if not exists public.measurement_presets (
    category_id text primary key,
    field_names text[] not null default '{}',
    updated_by uuid
        references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);
