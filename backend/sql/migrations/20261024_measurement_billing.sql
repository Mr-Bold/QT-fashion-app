alter table public.measurement_presets
    add column if not exists default_cloth_amount numeric(12,2)
    check (default_cloth_amount is null or default_cloth_amount >= 0);

alter table public.orders
    add column if not exists unit_price numeric(12,2) not null default 0
        check (unit_price >= 0),
    add column if not exists cloth_amount numeric(12,2) not null default 0
        check (cloth_amount >= 0),
    add column if not exists discount_amount numeric(12,2) not null default 0
        check (discount_amount >= 0);

update public.orders
set unit_price = total_amount
where unit_price = 0 and total_amount > 0;
