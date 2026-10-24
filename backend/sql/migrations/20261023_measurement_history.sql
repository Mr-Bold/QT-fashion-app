alter table public.measurement_sessions
    add column if not exists previous_session_id uuid
        references public.measurement_sessions(id) on delete set null;
