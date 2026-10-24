alter table public.profiles
    add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

create table if not exists public.task_updates (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    updated_by uuid references public.profiles(id) on delete set null,
    previous_status text,
    new_status text,
    comment text,
    created_at timestamptz not null default now()
);

create index if not exists idx_task_updates_task_created
    on public.task_updates (task_id, created_at desc);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    message text not null,
    notification_type text,
    related_task_id uuid references public.tasks(id) on delete set null,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient
    on public.notifications (recipient_id, created_at desc);

drop policy if exists apprentices_add_own_task_updates on public.task_updates;

create or replace function public.owner_create_apprentice_task(
    task_title text,
    task_description text,
    apprentice_user_id uuid,
    related_order_id uuid,
    task_deadline date,
    task_priority text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    created_task_id uuid;
    task_priority_value text := lower(coalesce(task_priority, 'normal'));
begin
    if not public.is_active_shop_owner() then
        raise exception 'Only an active shop owner can assign tasks.';
    end if;
    if char_length(btrim(coalesce(task_title, ''))) not between 1 and 160 then
        raise exception 'Task titles must be between 1 and 160 characters.';
    end if;
    if char_length(coalesce(task_description, '')) > 1000 then
        raise exception 'Task instructions must be 1,000 characters or fewer.';
    end if;
    if task_deadline is null then
        raise exception 'Choose a task due date.';
    end if;
    if task_priority_value not in ('low', 'normal', 'high', 'urgent') then
        raise exception 'Choose a valid task priority.';
    end if;
    if not exists (
        select 1
        from public.apprentice_profiles ap
        join public.profiles p on p.id = ap.user_id
        where ap.user_id = apprentice_user_id
          and ap.status = 'active'
          and p.is_active = true
    ) then
        raise exception 'Select an active apprentice with portal access.';
    end if;

    insert into public.tasks (
        order_id, title, description, assigned_to, assigned_by,
        priority, status, deadline
    )
    values (
        related_order_id, btrim(task_title), nullif(btrim(task_description), ''),
        apprentice_user_id, auth.uid(), task_priority_value, 'assigned', task_deadline
    )
    returning id into created_task_id;

    insert into public.task_updates (task_id, updated_by, new_status, comment)
    values (created_task_id, auth.uid(), 'assigned', 'Task assigned.');

    insert into public.notifications (recipient_id, title, message, notification_type, related_task_id)
    values (apprentice_user_id, 'New task assigned', btrim(task_title), 'task_assigned', created_task_id);

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
        auth.uid(),
        'task.created',
        'task',
        created_task_id,
        jsonb_build_object('entity_label', btrim(task_title) || ' · assigned to apprentice')
    );

    return created_task_id;
end;
$$;

create or replace function public.update_task_work_status(
    target_task_id uuid,
    target_status text,
    update_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    task_record public.tasks%rowtype;
    actor_is_owner boolean;
    status_label text;
begin
    select * into task_record
    from public.tasks
    where id = target_task_id
    for update;
    if not found then
        raise exception 'Task not found.';
    end if;

    actor_is_owner := public.is_active_shop_owner();
    if not actor_is_owner and task_record.assigned_to <> auth.uid() then
        raise exception 'You can only update tasks assigned to your account.';
    end if;
    if not actor_is_owner and not exists (
        select 1 from public.apprentice_profiles ap
        join public.profiles p on p.id = ap.user_id
        where ap.user_id = auth.uid()
          and ap.status = 'active'
          and p.role = 'apprentice'
          and p.is_active = true
    ) then
        raise exception 'This apprentice account is inactive.';
    end if;

    if target_status not in ('assigned', 'accepted', 'in_progress', 'submitted_for_review', 'revision_required', 'approved', 'completed', 'cancelled') then
        raise exception 'Choose a valid task status.';
    end if;
    if char_length(coalesce(update_comment, '')) > 500 then
        raise exception 'Progress notes must be 500 characters or fewer.';
    end if;
    if not actor_is_owner and not (
        (task_record.status = 'assigned' and target_status = 'accepted')
        or (task_record.status = 'accepted' and target_status = 'in_progress')
        or (task_record.status = 'in_progress' and target_status = 'submitted_for_review')
        or (task_record.status = 'revision_required' and target_status = 'in_progress')
    ) then
        raise exception 'That action is not available for this task at its current stage.';
    end if;
    if task_record.status = target_status and coalesce(btrim(update_comment), '') = '' then
        return;
    end if;

    update public.tasks
    set status = target_status, updated_at = now()
    where id = target_task_id;

    insert into public.task_updates (task_id, updated_by, previous_status, new_status, comment)
    values (
        target_task_id,
        auth.uid(),
        task_record.status,
        target_status,
        nullif(btrim(update_comment), '')
    );

    status_label := replace(initcap(replace(target_status, '_', ' ')), 'Submitted For Review', 'Submitted for review');
    if actor_is_owner then
        insert into public.notifications (recipient_id, title, message, notification_type, related_task_id)
        values (
            task_record.assigned_to,
            'Task updated by the shop',
            task_record.title || ' · ' || status_label,
            'task_status',
            target_task_id
        );
    else
        insert into public.notifications (recipient_id, title, message, notification_type, related_task_id)
        values (
            task_record.assigned_by,
            case when target_status = 'submitted_for_review' then 'Work ready for review' else 'Apprentice task update' end,
            task_record.title || ' · ' || status_label,
            'task_status',
            target_task_id
        );
    end if;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
        auth.uid(),
        'task.status_changed',
        'task',
        target_task_id,
        jsonb_build_object(
            'entity_label',
            task_record.title || ': ' ||
                replace(initcap(replace(task_record.status, '_', ' ')), 'Submitted For Review', 'Submitted for review') ||
                ' → ' || status_label ||
                case when nullif(btrim(update_comment), '') is null then '' else ' · ' || left(btrim(update_comment), 200) end,
            'comment', nullif(btrim(update_comment), '')
        )
    );
end;
$$;

revoke all on function public.owner_create_apprentice_task(text, text, uuid, uuid, date, text) from public;
revoke all on function public.update_task_work_status(uuid, text, text) from public;
grant execute on function public.owner_create_apprentice_task(text, text, uuid, uuid, date, text) to authenticated;
grant execute on function public.update_task_work_status(uuid, text, text) to authenticated;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
        ) then
            alter publication supabase_realtime add table public.tasks;
        end if;
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_updates'
        ) then
            alter publication supabase_realtime add table public.task_updates;
        end if;
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_logs'
        ) then
            alter publication supabase_realtime add table public.audit_logs;
        end if;
    end if;
end;
$$;
