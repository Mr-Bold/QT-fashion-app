create table if not exists public.apprentice_training_records (
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

create index if not exists idx_apprentice_training_records_user_date
    on public.apprentice_training_records (apprentice_user_id, record_date desc);
