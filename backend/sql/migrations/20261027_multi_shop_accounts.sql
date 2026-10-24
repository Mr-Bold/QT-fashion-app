-- Give each shop owner a private tenant. Run after all feature migrations,
-- including the apprentice portal and task workflow, then rerun sql/security.sql.

alter table public.profiles
  add column if not exists owner_id uuid;

update public.profiles
set owner_id = id
where role = 'owner' and owner_id is null;

alter table public.apprentice_profiles add column if not exists owner_id uuid;
alter table public.apprentice_training_records add column if not exists owner_id uuid;
alter table public.customers add column if not exists owner_id uuid;
alter table public.customer_notes add column if not exists owner_id uuid;
alter table public.measurement_sessions add column if not exists owner_id uuid;
alter table public.measurement_values add column if not exists owner_id uuid;
alter table public.measurement_presets add column if not exists owner_id uuid;
alter table public.orders add column if not exists owner_id uuid;
alter table public.order_photos add column if not exists owner_id uuid;
alter table public.tasks add column if not exists owner_id uuid;
alter table public.task_updates add column if not exists owner_id uuid;
alter table public.task_attachments add column if not exists owner_id uuid;
alter table public.task_reviews add column if not exists owner_id uuid;
alter table public.payments add column if not exists owner_id uuid;
alter table public.notifications add column if not exists owner_id uuid;
alter table public.audit_logs add column if not exists owner_id uuid;

-- Legacy rows can only be assigned automatically when there is one active
-- owner. If a populated project already has several owners, stop rather than
-- silently placing another shop's data in the wrong tenant.
do $$
declare
  active_owner_count integer;
  table_name text;
  has_unassigned_rows boolean;
  legacy_owner_id uuid;
begin
  select count(*), (array_agg(id order by id))[1]
  into active_owner_count, legacy_owner_id
  from public.profiles
  where role = 'owner' and is_active = true;

  if exists (select 1 from public.apprentice_profiles where owner_id is null)
     and active_owner_count <> 1 then
    raise exception 'Cannot safely assign existing apprentice records. Resolve their shop owner before applying this migration.';
  end if;

  if active_owner_count = 1 then
    update public.profiles
    set owner_id = legacy_owner_id
    where role = 'apprentice' and owner_id is null;
    update public.apprentice_profiles
    set owner_id = legacy_owner_id
    where owner_id is null;
  end if;

  foreach table_name in array array[
    'apprentice_training_records',
    'customers',
    'customer_notes',
    'measurement_sessions',
    'measurement_values',
    'measurement_presets',
    'orders',
    'order_photos',
    'tasks',
    'task_updates',
    'task_attachments',
    'task_reviews',
    'payments',
    'notifications',
    'audit_logs'
  ] loop
    execute format('select exists (select 1 from public.%I where owner_id is null)', table_name)
      into has_unassigned_rows;
    if has_unassigned_rows and active_owner_count <> 1 then
      raise exception 'Cannot safely assign existing rows in public.% to a shop. Resolve existing ownership before applying this migration.', table_name;
    end if;
    if has_unassigned_rows then
      execute format('update public.%I set owner_id = $1 where owner_id is null', table_name)
        using legacy_owner_id;
    end if;
  end loop;
end;
$$;

alter table public.apprentice_profiles alter column owner_id set default auth.uid();
alter table public.apprentice_profiles alter column owner_id set not null;
alter table public.apprentice_training_records alter column owner_id set default auth.uid();
alter table public.apprentice_training_records alter column owner_id set not null;
alter table public.customers alter column owner_id set default auth.uid();
alter table public.customers alter column owner_id set not null;
alter table public.customer_notes alter column owner_id set default auth.uid();
alter table public.customer_notes alter column owner_id set not null;
alter table public.measurement_sessions alter column owner_id set default auth.uid();
alter table public.measurement_sessions alter column owner_id set not null;
alter table public.measurement_values alter column owner_id set default auth.uid();
alter table public.measurement_values alter column owner_id set not null;
alter table public.measurement_presets alter column owner_id set default auth.uid();
alter table public.measurement_presets alter column owner_id set not null;
alter table public.orders alter column owner_id set default auth.uid();
alter table public.orders alter column owner_id set not null;
alter table public.order_photos alter column owner_id set default auth.uid();
alter table public.order_photos alter column owner_id set not null;
alter table public.tasks alter column owner_id set default auth.uid();
alter table public.tasks alter column owner_id set not null;
alter table public.task_updates alter column owner_id set default auth.uid();
alter table public.task_updates alter column owner_id set not null;
alter table public.task_attachments alter column owner_id set default auth.uid();
alter table public.task_attachments alter column owner_id set not null;
alter table public.task_reviews alter column owner_id set default auth.uid();
alter table public.task_reviews alter column owner_id set not null;
alter table public.payments alter column owner_id set default auth.uid();
alter table public.payments alter column owner_id set not null;
alter table public.notifications alter column owner_id set default auth.uid();
alter table public.notifications alter column owner_id set not null;
alter table public.audit_logs alter column owner_id set default auth.uid();
alter table public.audit_logs alter column owner_id set not null;

alter table public.profiles
  add constraint profiles_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;

alter table public.apprentice_profiles
  add constraint apprentice_profiles_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.apprentice_training_records
  add constraint apprentice_training_records_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.customers
  add constraint customers_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.customer_notes
  add constraint customer_notes_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.measurement_sessions
  add constraint measurement_sessions_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.measurement_values
  add constraint measurement_values_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.measurement_presets
  add constraint measurement_presets_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.orders
  add constraint orders_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.order_photos
  add constraint order_photos_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.tasks
  add constraint tasks_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.task_updates
  add constraint task_updates_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.task_attachments
  add constraint task_attachments_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.task_reviews
  add constraint task_reviews_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.payments
  add constraint payments_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.notifications
  add constraint notifications_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;
alter table public.audit_logs
  add constraint audit_logs_owner_id_fkey foreign key (owner_id)
  references public.profiles(id) on delete cascade;

alter table public.measurement_presets drop constraint if exists measurement_presets_pkey;
alter table public.measurement_presets
  add constraint measurement_presets_pkey primary key (owner_id, category_id);

alter table public.profiles add constraint profiles_owner_id_id_key unique (owner_id, id);
alter table public.apprentice_profiles add constraint apprentice_profiles_owner_user_key unique (owner_id, user_id);
alter table public.customers add constraint customers_owner_id_id_key unique (owner_id, id);
alter table public.measurement_sessions add constraint measurement_sessions_owner_id_id_key unique (owner_id, id);
alter table public.orders add constraint orders_owner_id_id_key unique (owner_id, id);
alter table public.tasks add constraint tasks_owner_id_id_key unique (owner_id, id);

alter table public.apprentice_profiles
  add constraint apprentice_profiles_owner_user_fkey
  foreign key (owner_id, user_id) references public.profiles(owner_id, id);
alter table public.apprentice_training_records
  add constraint apprentice_training_records_owner_apprentice_fkey
  foreign key (owner_id, apprentice_user_id) references public.apprentice_profiles(owner_id, user_id) on delete cascade;
alter table public.apprentice_training_records
  add constraint apprentice_training_records_owner_recorder_fkey
  foreign key (owner_id, recorded_by) references public.profiles(owner_id, id);
alter table public.customers
  add constraint customers_owner_creator_fkey
  foreign key (owner_id, created_by) references public.profiles(owner_id, id);
alter table public.customer_notes
  add constraint customer_notes_owner_customer_fkey
  foreign key (owner_id, customer_id) references public.customers(owner_id, id) on delete cascade;
alter table public.customer_notes
  add constraint customer_notes_owner_creator_fkey
  foreign key (owner_id, created_by) references public.profiles(owner_id, id);
alter table public.measurement_sessions
  add constraint measurement_sessions_owner_customer_fkey
  foreign key (owner_id, customer_id) references public.customers(owner_id, id) on delete restrict;
alter table public.measurement_sessions
  add constraint measurement_sessions_owner_recorder_fkey
  foreign key (owner_id, recorded_by) references public.profiles(owner_id, id);
alter table public.measurement_sessions
  add constraint measurement_sessions_owner_previous_fkey
  foreign key (owner_id, previous_session_id) references public.measurement_sessions(owner_id, id);
alter table public.measurement_values
  add constraint measurement_values_owner_session_fkey
  foreign key (owner_id, measurement_session_id) references public.measurement_sessions(owner_id, id) on delete cascade;
alter table public.measurement_presets
  add constraint measurement_presets_owner_updater_fkey
  foreign key (owner_id, updated_by) references public.profiles(owner_id, id);
alter table public.orders
  add constraint orders_owner_customer_fkey
  foreign key (owner_id, customer_id) references public.customers(owner_id, id) on delete restrict;
alter table public.orders
  add constraint orders_owner_creator_fkey
  foreign key (owner_id, created_by) references public.profiles(owner_id, id);
alter table public.order_photos
  add constraint order_photos_owner_order_fkey
  foreign key (owner_id, order_id) references public.orders(owner_id, id) on delete cascade;
alter table public.order_photos
  add constraint order_photos_owner_uploader_fkey
  foreign key (owner_id, uploaded_by) references public.profiles(owner_id, id);
alter table public.tasks
  add constraint tasks_owner_order_fkey
  foreign key (owner_id, order_id) references public.orders(owner_id, id) on delete restrict;
alter table public.tasks
  add constraint tasks_owner_assignee_fkey
  foreign key (owner_id, assigned_to) references public.apprentice_profiles(owner_id, user_id) on delete restrict;
alter table public.tasks
  add constraint tasks_owner_assigner_fkey
  foreign key (owner_id, assigned_by) references public.profiles(owner_id, id) on delete restrict;
alter table public.task_updates
  add constraint task_updates_owner_task_fkey
  foreign key (owner_id, task_id) references public.tasks(owner_id, id) on delete cascade;
alter table public.task_updates
  add constraint task_updates_owner_actor_fkey
  foreign key (owner_id, updated_by) references public.profiles(owner_id, id);
alter table public.task_attachments
  add constraint task_attachments_owner_task_fkey
  foreign key (owner_id, task_id) references public.tasks(owner_id, id) on delete cascade;
alter table public.task_attachments
  add constraint task_attachments_owner_uploader_fkey
  foreign key (owner_id, uploaded_by) references public.profiles(owner_id, id);
alter table public.task_reviews
  add constraint task_reviews_owner_task_fkey
  foreign key (owner_id, task_id) references public.tasks(owner_id, id) on delete cascade;
alter table public.task_reviews
  add constraint task_reviews_owner_reviewer_fkey
  foreign key (owner_id, reviewed_by) references public.profiles(owner_id, id) on delete restrict;
alter table public.payments
  add constraint payments_owner_order_fkey
  foreign key (owner_id, order_id) references public.orders(owner_id, id) on delete restrict;
alter table public.payments
  add constraint payments_owner_recorder_fkey
  foreign key (owner_id, recorded_by) references public.profiles(owner_id, id);
alter table public.notifications
  add constraint notifications_owner_recipient_fkey
  foreign key (owner_id, recipient_id) references public.profiles(owner_id, id) on delete cascade;
alter table public.notifications
  add constraint notifications_owner_task_fkey
  foreign key (owner_id, related_task_id) references public.tasks(owner_id, id)
  deferrable initially deferred;
alter table public.audit_logs
  add constraint audit_logs_owner_actor_fkey
  foreign key (owner_id, actor_id) references public.profiles(owner_id, id);

create or replace function public.current_shop_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.role = 'owner' and p.is_active then p.id
    when p.role = 'apprentice' and p.is_active
      and exists (
        select 1
        from public.apprentice_profiles ap
        where ap.user_id = p.id
          and ap.owner_id = p.owner_id
          and ap.status = 'active'
      )
      then p.owner_id
    else null
  end
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.current_shop_owner_id() from public;
grant execute on function public.current_shop_owner_id() to authenticated;

create or replace function public.is_active_shop_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'owner'
      and p.is_active = true
  );
$$;

revoke all on function public.is_active_shop_owner() from public;
grant execute on function public.is_active_shop_owner() to authenticated;

alter table public.apprentice_profiles alter column owner_id set default public.current_shop_owner_id();
alter table public.apprentice_training_records alter column owner_id set default public.current_shop_owner_id();
alter table public.customers alter column owner_id set default public.current_shop_owner_id();
alter table public.customer_notes alter column owner_id set default public.current_shop_owner_id();
alter table public.measurement_sessions alter column owner_id set default public.current_shop_owner_id();
alter table public.measurement_values alter column owner_id set default public.current_shop_owner_id();
alter table public.measurement_presets alter column owner_id set default public.current_shop_owner_id();
alter table public.orders alter column owner_id set default public.current_shop_owner_id();
alter table public.order_photos alter column owner_id set default public.current_shop_owner_id();
alter table public.tasks alter column owner_id set default public.current_shop_owner_id();
alter table public.task_updates alter column owner_id set default public.current_shop_owner_id();
alter table public.task_attachments alter column owner_id set default public.current_shop_owner_id();
alter table public.task_reviews alter column owner_id set default public.current_shop_owner_id();
alter table public.payments alter column owner_id set default public.current_shop_owner_id();
alter table public.notifications alter column owner_id set default public.current_shop_owner_id();
alter table public.audit_logs alter column owner_id set default public.current_shop_owner_id();

-- A public signup can create a shop owner, but never chooses its own role from
-- user-editable metadata. Apprentice invitations are demoted server-side.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, owner_id, full_name, email, phone, role, is_active)
  values (
    new.id,
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Shop owner'), '@', 1)),
    new.email,
    new.phone,
    'owner',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Owner-only data gets an owner boundary. Apprentice policies remain narrow
-- read access to assigned work and are recreated in sql/security.sql.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'apprentice_profiles',
    'apprentice_training_records',
    'shop_settings',
    'customers',
    'customer_notes',
    'measurement_sessions',
    'measurement_values',
    'measurement_presets',
    'orders',
    'order_photos',
    'tasks',
    'task_updates',
    'task_attachments',
    'task_reviews',
    'payments',
    'notifications',
    'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists owners_manage_all on public.%I', table_name);
    execute format(
      'create policy owners_manage_all on public.%I for all to authenticated using (owner_id = (select auth.uid()) and (select public.is_active_shop_owner())) with check (owner_id = (select auth.uid()) and (select public.is_active_shop_owner()))',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists authenticated_read_measurement_presets on public.measurement_presets;
create policy authenticated_read_measurement_presets on public.measurement_presets
for select to authenticated
using (
  owner_id = (select auth.uid())
  and (select public.is_active_shop_owner())
);

alter table public.profiles enable row level security;
drop policy if exists owners_manage_all on public.profiles;
drop policy if exists owners_read_shop_profiles on public.profiles;
create policy owners_read_shop_profiles on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (
    owner_id = (select auth.uid())
    and role = 'apprentice'
    and (select public.is_active_shop_owner())
  )
);

drop policy if exists apprentices_read_own_profile on public.apprentice_profiles;
create policy apprentices_read_own_profile on public.apprentice_profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  and owner_id = (select public.current_shop_owner_id())
);

drop policy if exists apprentices_read_assigned_tasks on public.tasks;
create policy apprentices_read_assigned_tasks on public.tasks
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and assigned_to = (select auth.uid())
);

drop policy if exists apprentices_read_assigned_orders on public.orders;
create policy apprentices_read_assigned_orders on public.orders
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and (select public.is_assigned_to_order(id))
);

drop policy if exists apprentices_read_assigned_customers on public.customers;
create policy apprentices_read_assigned_customers on public.customers
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and (select public.can_access_customer(id))
);

drop policy if exists apprentices_read_assigned_customer_notes on public.customer_notes;
create policy apprentices_read_assigned_customer_notes on public.customer_notes
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and (select public.can_access_customer(customer_id))
);

drop policy if exists apprentices_read_assigned_measurements on public.measurement_sessions;
create policy apprentices_read_assigned_measurements on public.measurement_sessions
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and (select public.can_access_customer(customer_id))
);

drop policy if exists apprentices_read_assigned_measurement_values on public.measurement_values;
create policy apprentices_read_assigned_measurement_values on public.measurement_values
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and exists (
    select 1
    from public.measurement_sessions ms
    where ms.id = measurement_session_id
      and ms.owner_id = owner_id
      and (select public.can_access_customer(ms.customer_id))
  )
);

drop policy if exists apprentices_read_own_task_updates on public.task_updates;
create policy apprentices_read_own_task_updates on public.task_updates
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and t.owner_id = owner_id
      and t.assigned_to = (select auth.uid())
  )
);

drop policy if exists apprentices_read_own_task_attachments on public.task_attachments;
create policy apprentices_read_own_task_attachments on public.task_attachments
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and t.owner_id = owner_id
      and t.assigned_to = (select auth.uid())
  )
);

drop policy if exists apprentices_add_own_task_attachments on public.task_attachments;
create policy apprentices_add_own_task_attachments on public.task_attachments
for insert to authenticated
with check (
  owner_id = (select public.current_shop_owner_id())
  and uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and t.owner_id = owner_id
      and t.assigned_to = (select auth.uid())
  )
);

drop policy if exists users_read_own_notifications on public.notifications;
create policy users_read_own_notifications on public.notifications
for select to authenticated
using (
  recipient_id = (select auth.uid())
  and owner_id = (select public.current_shop_owner_id())
);

drop policy if exists users_update_own_notifications on public.notifications;
create policy users_update_own_notifications on public.notifications
for update to authenticated
using (
  recipient_id = (select auth.uid())
  and owner_id = (select public.current_shop_owner_id())
)
with check (
  recipient_id = (select auth.uid())
  and owner_id = (select public.current_shop_owner_id())
);

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
          and ap.owner_id = auth.uid()
          and p.owner_id = auth.uid()
          and ap.status = 'active'
          and p.is_active = true
    ) then
        raise exception 'Select an active apprentice from your shop.';
    end if;
    if related_order_id is not null and not exists (
        select 1 from public.orders o
        where o.id = related_order_id and o.owner_id = auth.uid()
    ) then
        raise exception 'Choose an order from your shop.';
    end if;

    insert into public.tasks (
        owner_id, order_id, title, description, assigned_to, assigned_by,
        priority, status, deadline
    )
    values (
        auth.uid(), related_order_id, btrim(task_title), nullif(btrim(task_description), ''),
        apprentice_user_id, auth.uid(), task_priority_value, 'assigned', task_deadline
    )
    returning id into created_task_id;

    insert into public.task_updates (owner_id, task_id, updated_by, new_status, comment)
    values (auth.uid(), created_task_id, auth.uid(), 'assigned', 'Task assigned.');

    insert into public.notifications (owner_id, recipient_id, title, message, notification_type, related_task_id)
    values (auth.uid(), apprentice_user_id, 'New task assigned', btrim(task_title), 'task_assigned', created_task_id);

    insert into public.audit_logs (owner_id, actor_id, action, entity_type, entity_id, details)
    values (
        auth.uid(),
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
    if actor_is_owner and task_record.owner_id <> auth.uid() then
        raise exception 'You can only update tasks in your shop.';
    end if;
    if not actor_is_owner and (
        task_record.assigned_to <> auth.uid()
        or task_record.owner_id <> public.current_shop_owner_id()
    ) then
        raise exception 'You can only update tasks assigned to your account.';
    end if;
    if not actor_is_owner and not exists (
        select 1 from public.apprentice_profiles ap
        join public.profiles p on p.id = ap.user_id
        where ap.user_id = auth.uid()
          and ap.owner_id = task_record.owner_id
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
    where id = target_task_id and owner_id = task_record.owner_id;

    insert into public.task_updates (owner_id, task_id, updated_by, previous_status, new_status, comment)
    values (
        task_record.owner_id,
        target_task_id,
        auth.uid(),
        task_record.status,
        target_status,
        nullif(btrim(update_comment), '')
    );

    status_label := replace(initcap(replace(target_status, '_', ' ')), 'Submitted For Review', 'Submitted for review');
    if actor_is_owner then
        insert into public.notifications (owner_id, recipient_id, title, message, notification_type, related_task_id)
        values (
            task_record.owner_id,
            task_record.assigned_to,
            'Task updated by the shop',
            task_record.title || ' · ' || status_label,
            'task_status',
            target_task_id
        );
    else
        insert into public.notifications (owner_id, recipient_id, title, message, notification_type, related_task_id)
        values (
            task_record.owner_id,
            task_record.assigned_by,
            case when target_status = 'submitted_for_review' then 'Work ready for review' else 'Apprentice task update' end,
            task_record.title || ' · ' || status_label,
            'task_status',
            target_task_id
        );
    end if;

    insert into public.audit_logs (owner_id, actor_id, action, entity_type, entity_id, details)
    values (
        task_record.owner_id,
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
    if actor_is_owner and task_record.owner_id <> auth.uid() then
        raise exception 'You can only update checklists for tasks in your shop.';
    end if;
    if not actor_is_owner and not exists (
        select 1
        from public.apprentice_profiles ap
        join public.profiles p on p.id = ap.user_id
        where ap.user_id = auth.uid()
          and task_record.assigned_to = auth.uid()
          and task_record.owner_id = ap.owner_id
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
    where id = target_task_id and owner_id = task_record.owner_id;

    insert into public.task_updates (owner_id, task_id, updated_by, previous_status, new_status, comment)
    values (
        task_record.owner_id,
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
    where id = target_task_id and owner_id = auth.uid()
    for update;
    if not found then
        raise exception 'Task not found in your shop.';
    end if;
    if task_record.status <> 'submitted_for_review' then
        raise exception 'Only work submitted for review can be approved or returned for revision.';
    end if;

    next_status := case when review_decision = 'approved' then 'completed' else 'revision_required' end;
    insert into public.task_reviews (owner_id, task_id, reviewed_by, decision, feedback)
    values (task_record.owner_id, target_task_id, auth.uid(), review_decision, nullif(btrim(review_feedback), ''));

    perform public.update_task_work_status(
        target_task_id,
        next_status,
        nullif(btrim(review_feedback), '')
    );
end;
$$;

revoke all on function public.owner_create_apprentice_task(text, text, uuid, uuid, date, text) from public;
revoke all on function public.update_task_work_status(uuid, text, text) from public;
revoke all on function public.update_task_checklist(uuid, jsonb) from public;
revoke all on function public.review_apprentice_task(uuid, text, text) from public;
grant execute on function public.owner_create_apprentice_task(text, text, uuid, uuid, date, text) to authenticated;
grant execute on function public.update_task_work_status(uuid, text, text) to authenticated;
grant execute on function public.update_task_checklist(uuid, jsonb) to authenticated;
grant execute on function public.review_apprentice_task(uuid, text, text) to authenticated;

drop policy if exists owners_manage_customer_photos on storage.objects;
create policy owners_manage_customer_photos on storage.objects
for all to authenticated
using (
  bucket_id = 'customer-photos'
  and (select public.is_active_shop_owner())
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'customer-photos'
  and (select public.is_active_shop_owner())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists apprentices_read_assigned_measurement_photos on storage.objects;
create policy apprentices_read_assigned_measurement_photos on storage.objects
for select to authenticated
using (
    bucket_id = 'customer-photos'
    and exists (
        select 1
        from public.measurement_sessions ms
        join public.orders o on o.customer_id = ms.customer_id and o.owner_id = ms.owner_id
        join public.tasks t on t.order_id = o.id and t.owner_id = o.owner_id
        join public.apprentice_profiles ap on ap.user_id = t.assigned_to and ap.owner_id = t.owner_id
        join public.profiles p on p.id = t.assigned_to and p.owner_id = t.owner_id
        where t.assigned_to = (select auth.uid())
          and t.owner_id = (select public.current_shop_owner_id())
          and ap.status = 'active'
          and p.role = 'apprentice'
          and p.is_active = true
          and (storage.foldername(name))[1] = t.owner_id::text
          and storage.objects.name = any(ms.garment_photo_paths || ms.style_photo_paths)
    )
);
