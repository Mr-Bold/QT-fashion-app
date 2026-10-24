-- Run after the database schema, feature migrations, and multi-shop migration.
-- All management data is private by default; active owners can manage shop records.

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
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Apprentice'), '@', 1)),
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

create or replace function public.is_assigned_to_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.order_id = target_order_id
      and t.owner_id = (select public.current_shop_owner_id())
      and t.assigned_to = (select auth.uid())
  );
$$;

create or replace function public.can_access_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.customer_id = target_customer_id
      and o.owner_id = (select public.current_shop_owner_id())
      and public.is_assigned_to_order(o.id)
  );
$$;

revoke all on function public.is_assigned_to_order(uuid) from public;
revoke all on function public.can_access_customer(uuid) from public;
grant execute on function public.is_assigned_to_order(uuid) to authenticated;
grant execute on function public.can_access_customer(uuid) to authenticated;

-- Owner-only tables. The separate assigned-work policies below grant apprentices
-- read access only to the customer/order information needed for their tasks.
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
using (owner_id = (select auth.uid()) and (select public.is_active_shop_owner()));

alter table public.profiles enable row level security;
drop policy if exists users_read_own_profile on public.profiles;
create policy users_read_own_profile on public.profiles
for select to authenticated
using (id = (select auth.uid()));
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
  and
  exists (
    select 1
    from public.measurement_sessions ms
    where ms.id = measurement_session_id
      and ms.owner_id = public.measurement_values.owner_id
      and public.can_access_customer(ms.customer_id)
  )
);

drop policy if exists apprentices_read_assigned_order_photos on public.order_photos;
create policy apprentices_read_assigned_order_photos on public.order_photos
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and (select public.is_assigned_to_order(order_id))
);

drop policy if exists apprentices_read_own_task_updates on public.task_updates;
create policy apprentices_read_own_task_updates on public.task_updates
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and t.owner_id = public.task_updates.owner_id
      and t.assigned_to = (select auth.uid())
  )
);
drop policy if exists apprentices_add_own_task_updates on public.task_updates;

drop policy if exists apprentices_read_own_task_attachments on public.task_attachments;
create policy apprentices_read_own_task_attachments on public.task_attachments
for select to authenticated
using (
  owner_id = (select public.current_shop_owner_id())
  and
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and t.owner_id = public.task_attachments.owner_id
      and t.assigned_to = (select auth.uid())
  )
);
drop policy if exists apprentices_add_own_task_attachments on public.task_attachments;
create policy apprentices_add_own_task_attachments on public.task_attachments
for insert to authenticated
with check (
  owner_id = (select public.current_shop_owner_id())
  and
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and t.owner_id = public.task_attachments.owner_id
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
using (recipient_id = (select auth.uid()))
with check (
  recipient_id = (select auth.uid())
  and owner_id = (select public.current_shop_owner_id())
);

insert into storage.buckets (id, name, public)
values ('customer-photos', 'customer-photos', false)
on conflict (id) do update set public = false;

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
