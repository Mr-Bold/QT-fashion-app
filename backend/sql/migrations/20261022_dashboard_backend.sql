alter table public.customers
    add column if not exists gender text,
    add column if not exists preferred_garment text;

alter table public.apprentice_profiles
    add column if not exists status text not null default 'active'
        check (status in ('active', 'on_leave', 'completed'));

create table if not exists public.shop_settings (
    owner_id uuid primary key references public.profiles(id) on delete cascade,
    shop_name text not null default 'QT Fashion app',
    phone text not null default '',
    email text not null default '',
    address text not null default '',
    currency text not null default 'GHS' check (currency in ('GHS', 'USD')),
    measurement_unit text not null default 'inches' check (measurement_unit in ('inches', 'cm')),
    notifications jsonb not null default '{"dueTasks":true,"paymentReceived":true,"deliveryReminders":true,"weeklySummary":false}'::jsonb,
    updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('customer-photos', 'customer-photos', false)
on conflict (id) do update set public = false;
