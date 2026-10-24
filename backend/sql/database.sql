
-- =====================================================
-- QT FASHION APP MANAGEMENT SYSTEM
-- Database: PostgreSQL / Supabase
-- =====================================================

create extension if not exists pgcrypto;

-- 1. USER PROFILES
-- Supabase Auth manages passwords and authentication.

create table public.profiles (
    id uuid primary key references auth.users(id) on delete restrict,
    full_name text not null,
    email text,
    phone text,
    role text not null default 'apprentice'
        check (role in ('owner', 'apprentice')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

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

-- 2. APPRENTICE PROFILES

create table public.apprentice_profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique
        references public.profiles(id) on delete restrict,
    start_date date,
    skill_level text
        check (skill_level in ('beginner', 'intermediate', 'advanced')),
    specialization text,
    status text not null default 'active'
        check (status in ('active', 'on_leave', 'completed')),
    notes text,
    created_at timestamptz not null default now()
);

alter table public.apprentice_profiles
    add column if not exists status text not null default 'active'
        check (status in ('active', 'on_leave', 'completed'));

create table public.apprentice_training_records (
    id uuid primary key default gen_random_uuid(),
    apprentice_user_id uuid not null
        references public.apprentice_profiles(user_id) on delete cascade,
    record_type text not null
        check (record_type in ('hours', 'skill', 'attendance', 'leave')),
    record_date date not null default current_date,
    hours numeric(5,2)
        check (hours is null or (hours >= 0.25 and hours <= 24)),
    activity text,
    skill_name text,
    skill_level text
        check (skill_level is null or skill_level in ('learning', 'confident')),
    attendance_status text
        check (attendance_status is null or attendance_status in ('present', 'late', 'absent')),
    leave_end_date date,
    notes text,
    recorded_by uuid
        references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    check (leave_end_date is null or leave_end_date >= record_date)
);

create index idx_apprentice_training_records_user_date
    on public.apprentice_training_records (apprentice_user_id, record_date desc);

-- 3. CUSTOMERS

create table public.customers (
    id uuid primary key default gen_random_uuid(),
    customer_number bigint generated always as identity unique,
    full_name text not null,
    phone text,
    whatsapp_number text,
    email text,
    address text,
    gender text,
    preferred_garment text,
    photo_path text,
    notes text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz
);

create index idx_customers_name
    on public.customers (full_name);

create index idx_customers_phone
    on public.customers (phone);

-- Customer notes preserve a dated history alongside orders and measurements.
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

-- 4. MEASUREMENT SESSIONS
-- Each session preserves measurements from a particular date.

create table public.measurement_sessions (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null
        references public.customers(id) on delete restrict,
    garment_type text not null,
    unit text not null default 'inches'
        check (unit in ('inches', 'cm')),
    recorded_by uuid
        references public.profiles(id) on delete set null,
    previous_session_id uuid
        references public.measurement_sessions(id) on delete set null,
    garment_photo_paths text[] not null default '{}'
        check (cardinality(garment_photo_paths) <= 2),
    style_photo_paths text[] not null default '{}'
        check (cardinality(style_photo_paths) <= 3),
    measurement_date date not null default current_date,
    notes text,
    created_at timestamptz not null default now()
);

create index idx_measurements_customer
    on public.measurement_sessions (customer_id, measurement_date desc);

-- 5. MEASUREMENT VALUES
-- Example: chest = 38, waist = 32, shoulder = 16.

create table public.measurement_values (
    id uuid primary key default gen_random_uuid(),
    measurement_session_id uuid not null
        references public.measurement_sessions(id) on delete cascade,
    field_name text not null,
    value numeric(8,2) not null check (value > 0),
    created_at timestamptz not null default now(),
    unique (measurement_session_id, field_name)
);

create table public.measurement_presets (
    category_id text primary key,
    field_names text[] not null default '{}',
    default_cloth_amount numeric(12,2)
        check (default_cloth_amount is null or default_cloth_amount >= 0),
    updated_by uuid
        references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);

-- 6. CUSTOMER ORDERS

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    order_number bigint generated always as identity unique,
    customer_id uuid not null
        references public.customers(id) on delete restrict,
    garment_type text not null,
    quantity integer not null default 1 check (quantity > 0),
    unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
    cloth_amount numeric(12,2) not null default 0 check (cloth_amount >= 0),
    discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
    description text,
    fabric_details text,
    total_amount numeric(12,2) not null default 0
        check (total_amount >= 0),
    delivery_date date,
    status text not null default 'pending'
        check (status in (
            'pending',
            'confirmed',
            'in_production',
            'fitting',
            'ready_for_collection',
            'delivered',
            'cancelled'
        )),
    created_by uuid
        references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_orders_customer
    on public.orders (customer_id);

create index idx_orders_delivery
    on public.orders (delivery_date);

create index idx_orders_status
    on public.orders (status);

-- 7. ORDER PHOTOS
-- Store file paths, not the actual image binary, in PostgreSQL.

create table public.order_photos (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null
        references public.orders(id) on delete cascade,
    storage_path text not null,
    photo_type text not null default 'design_reference'
        check (photo_type in (
            'design_reference',
            'customer_reference',
            'work_in_progress',
            'completed_garment'
        )),
    caption text,
    uploaded_by uuid
        references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 8. APPRENTICE TASKS

create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    order_id uuid
        references public.orders(id) on delete restrict,
    title text not null,
    description text,
    assigned_to uuid not null
        references public.apprentice_profiles(user_id) on delete restrict,
    assigned_by uuid not null
        references public.profiles(id) on delete restrict,
    priority text not null default 'normal'
        check (priority in ('low', 'normal', 'high', 'urgent')),
    status text not null default 'assigned'
        check (status in (
            'assigned',
            'accepted',
            'in_progress',
            'submitted_for_review',
            'revision_required',
            'approved',
            'completed',
            'cancelled'
        )),
    start_date date,
    deadline date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_tasks_assigned_to
    on public.tasks (assigned_to, status);

create index idx_tasks_deadline
    on public.tasks (deadline);

create index idx_tasks_order
    on public.tasks (order_id);

-- 9. TASK PROGRESS HISTORY

create table public.task_updates (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null
        references public.tasks(id) on delete cascade,
    updated_by uuid
        references public.profiles(id) on delete set null,
    previous_status text,
    new_status text,
    comment text,
    created_at timestamptz not null default now()
);

-- 10. TASK ATTACHMENTS

create table public.task_attachments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null
        references public.tasks(id) on delete cascade,
    storage_path text not null,
    attachment_type text not null default 'work_evidence'
        check (attachment_type in (
            'reference',
            'work_evidence',
            'other'
        )),
    caption text,
    uploaded_by uuid
        references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 11. TASK REVIEWS

create table public.task_reviews (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null
        references public.tasks(id) on delete cascade,
    reviewed_by uuid not null
        references public.profiles(id) on delete restrict,
    decision text not null
        check (decision in ('approved', 'revision_required')),
    feedback text,
    created_at timestamptz not null default now()
);

-- 12. PAYMENTS

create table public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null
        references public.orders(id) on delete restrict,
    amount numeric(12,2) not null check (amount > 0),
    payment_method text not null
        check (payment_method in (
            'cash',
            'mobile_money',
            'bank_transfer',
            'other'
        )),
    payment_reference text,
    recorded_by uuid
        references public.profiles(id) on delete set null,
    payment_date timestamptz not null default now(),
    status text not null default 'confirmed'
        check (status in ('pending', 'confirmed', 'voided')),
    created_at timestamptz not null default now()
);

create index idx_payments_order
    on public.payments (order_id);

-- 13. IN-APP NOTIFICATIONS

create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null
        references public.profiles(id) on delete cascade,
    title text not null,
    message text not null,
    notification_type text,
    related_task_id uuid
        references public.tasks(id) on delete set null,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index idx_notifications_recipient
    on public.notifications (recipient_id, created_at desc);

-- 14. AUDIT LOGS

create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid
        references public.profiles(id) on delete set null,
    action text not null,
    entity_type text not null,
    entity_id uuid,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index idx_audit_logs_entity
    on public.audit_logs (entity_type, entity_id);

create index idx_audit_logs_created
    on public.audit_logs (created_at desc);
