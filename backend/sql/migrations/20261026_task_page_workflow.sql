alter table public.tasks
    add column if not exists checklist jsonb not null default '[]'::jsonb;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'tasks_checklist_is_array'
          and conrelid = 'public.tasks'::regclass
    ) then
        alter table public.tasks
            add constraint tasks_checklist_is_array
            check (jsonb_typeof(checklist) = 'array');
    end if;
end;
$$;

create or replace function public.owner_create_apprentice_task_with_checklist(
    task_title text,
    task_description text,
    apprentice_user_id uuid,
    related_order_id uuid,
    task_deadline date,
    task_priority text,
    task_checklist jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    created_task_id uuid;
begin
    if task_checklist is null or jsonb_typeof(task_checklist) <> 'array' then
        raise exception 'A task checklist must be a JSON array.';
    end if;
    if jsonb_array_length(task_checklist) > 20 then
        raise exception 'A task checklist can contain up to 20 items.';
    end if;
    if exists (
        select 1
        from jsonb_array_elements(task_checklist) item
        where jsonb_typeof(item) <> 'object'
           or char_length(coalesce(btrim(item ->> 'id'), '')) not between 1 and 80
           or char_length(coalesce(btrim(item ->> 'label'), '')) not between 1 and 120
           or item ->> 'completed' is distinct from 'false'
    ) then
        raise exception 'Each new checklist item needs an ID, a label, and an unchecked state.';
    end if;
    if (
        select count(distinct item ->> 'id')
        from jsonb_array_elements(task_checklist) item
    ) <> jsonb_array_length(task_checklist) then
        raise exception 'Checklist item IDs must be unique.';
    end if;

    created_task_id := public.owner_create_apprentice_task(
        task_title,
        task_description,
        apprentice_user_id,
        related_order_id,
        task_deadline,
        task_priority
    );
    update public.tasks
    set checklist = task_checklist
    where id = created_task_id;
    return created_task_id;
end;
$$;

create or replace function public.update_task_checklist(
    target_task_id uuid,
    target_checklist jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    task_record public.tasks%rowtype;
    actor_is_owner boolean;
    changed_item text;
begin
    select * into task_record
    from public.tasks
    where id = target_task_id
    for update;
    if not found then
        raise exception 'Task not found.';
    end if;

    actor_is_owner := public.is_active_shop_owner();
    if not actor_is_owner and not exists (
        select 1
        from public.apprentice_profiles ap
        join public.profiles p on p.id = ap.user_id
        where ap.user_id = auth.uid()
          and task_record.assigned_to = auth.uid()
          and ap.status = 'active'
          and p.role = 'apprentice'
          and p.is_active = true
    ) then
        raise exception 'You can only update checklists for tasks assigned to your active account.';
    end if;
    if target_checklist is null or jsonb_typeof(target_checklist) <> 'array' then
        raise exception 'A task checklist must be a JSON array.';
    end if;
    if jsonb_array_length(target_checklist) > 20 then
        raise exception 'A task checklist can contain up to 20 items.';
    end if;
    if exists (
        select 1
        from jsonb_array_elements(target_checklist) item
        where jsonb_typeof(item) <> 'object'
           or char_length(coalesce(btrim(item ->> 'id'), '')) not between 1 and 80
           or char_length(coalesce(btrim(item ->> 'label'), '')) not between 1 and 120
           or item ->> 'completed' not in ('true', 'false')
    ) then
        raise exception 'Each checklist item needs an ID, a label, and a completion state.';
    end if;
    if (
        select count(distinct item ->> 'id')
        from jsonb_array_elements(target_checklist) item
    ) <> jsonb_array_length(target_checklist) then
        raise exception 'Checklist item IDs must be unique.';
    end if;
    if not actor_is_owner and (
        jsonb_array_length(target_checklist) <> jsonb_array_length(task_record.checklist)
        or exists (
            select 1
            from jsonb_array_elements(target_checklist) new_item
            where not exists (
                select 1
                from jsonb_array_elements(task_record.checklist) old_item
                where old_item ->> 'id' = new_item ->> 'id'
                  and old_item ->> 'label' = new_item ->> 'label'
            )
        )
    ) then
        raise exception 'Apprentices can update checklist progress but cannot change checklist items.';
    end if;
    if target_checklist = task_record.checklist then
        return;
    end if;

    select new_item ->> 'label' into changed_item
    from jsonb_array_elements(target_checklist) new_item
    left join jsonb_array_elements(task_record.checklist) old_item
      on old_item ->> 'id' = new_item ->> 'id'
    where old_item ->> 'completed' is distinct from new_item ->> 'completed'
    limit 1;

    update public.tasks
    set checklist = target_checklist, updated_at = now()
    where id = target_task_id;

    insert into public.task_updates (task_id, updated_by, previous_status, new_status, comment)
    values (
        target_task_id,
        auth.uid(),
        task_record.status,
        task_record.status,
        'Checklist updated' || case when changed_item is null then '.' else ': ' || left(changed_item, 150) end
    );
end;
$$;

create or replace function public.review_apprentice_task(
    target_task_id uuid,
    review_decision text,
    review_feedback text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    task_record public.tasks%rowtype;
    next_status text;
begin
    if not public.is_active_shop_owner() then
        raise exception 'Only an active shop owner can review apprentice work.';
    end if;
    if review_decision is null or review_decision not in ('approved', 'revision_required') then
        raise exception 'Choose approve or request a revision.';
    end if;
    if char_length(coalesce(review_feedback, '')) > 500 then
        raise exception 'Review feedback must be 500 characters or fewer.';
    end if;
    if review_decision = 'revision_required' and char_length(btrim(coalesce(review_feedback, ''))) = 0 then
        raise exception 'Add feedback so the apprentice knows what to revise.';
    end if;

    select * into task_record
    from public.tasks
    where id = target_task_id
    for update;
    if not found then
        raise exception 'Task not found.';
    end if;
    if task_record.status <> 'submitted_for_review' then
        raise exception 'Only work submitted for review can be approved or returned for revision.';
    end if;

    next_status := case when review_decision = 'approved' then 'completed' else 'revision_required' end;
    insert into public.task_reviews (task_id, reviewed_by, decision, feedback)
    values (target_task_id, auth.uid(), review_decision, nullif(btrim(review_feedback), ''));

    perform public.update_task_work_status(
        target_task_id,
        next_status,
        nullif(btrim(review_feedback), '')
    );
end;
$$;

drop policy if exists apprentices_read_assigned_measurement_photos on storage.objects;
create policy apprentices_read_assigned_measurement_photos on storage.objects
for select to authenticated
using (
    bucket_id = 'customer-photos'
    and exists (
        select 1
        from public.measurement_sessions ms
        join public.orders o on o.customer_id = ms.customer_id
        join public.tasks t on t.order_id = o.id
        join public.apprentice_profiles ap on ap.user_id = t.assigned_to
        join public.profiles p on p.id = t.assigned_to
        where t.assigned_to = (select auth.uid())
          and ap.status = 'active'
          and p.role = 'apprentice'
          and p.is_active = true
          and storage.objects.name = any(ms.garment_photo_paths || ms.style_photo_paths)
    )
);

revoke all on function public.owner_create_apprentice_task_with_checklist(text, text, uuid, uuid, date, text, jsonb) from public;
revoke all on function public.update_task_checklist(uuid, jsonb) from public;
revoke all on function public.review_apprentice_task(uuid, text, text) from public;
grant execute on function public.owner_create_apprentice_task_with_checklist(text, text, uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function public.update_task_checklist(uuid, jsonb) to authenticated;
grant execute on function public.review_apprentice_task(uuid, text, text) to authenticated;
