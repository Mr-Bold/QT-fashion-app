create table if not exists public.customer_notes (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null
        references public.customers(id) on delete cascade,
    content text not null
        check (char_length(btrim(content)) between 1 and 500),
    created_by uuid
        references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_customer_notes_customer
    on public.customer_notes (customer_id, created_at desc);
