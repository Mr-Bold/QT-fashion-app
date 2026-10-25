create table if not exists public.owner_account_deletions (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  apprentice_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.owner_account_deletions enable row level security;
revoke all on public.owner_account_deletions from public, anon, authenticated;
grant all on public.owner_account_deletions to service_role;

create or replace function public.prepare_owner_account_deletion(target_owner_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_profile public.profiles%rowtype;
  apprentice_ids uuid[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted account-deletion service can prepare this deletion.';
  end if;

  select *
  into owner_profile
  from public.profiles
  where id = target_owner_id
  for update;

  if found then
    if owner_profile.role <> 'owner'
       or owner_profile.is_active is not true
       or owner_profile.owner_id <> target_owner_id then
      raise exception 'The account is not an active shop owner.';
    end if;

    select coalesce(array_agg(p.id order by p.id), array[]::uuid[])
    into apprentice_ids
    from public.profiles p
    where p.owner_id = target_owner_id
      and p.role = 'apprentice';

    insert into public.owner_account_deletions (owner_user_id, apprentice_user_ids)
    values (target_owner_id, apprentice_ids)
    on conflict (owner_user_id) do nothing;

    select d.apprentice_user_ids
    into apprentice_ids
    from public.owner_account_deletions d
    where d.owner_user_id = target_owner_id;
  else
    select d.apprentice_user_ids
    into apprentice_ids
    from public.owner_account_deletions d
    where d.owner_user_id = target_owner_id;

    if not found then
      raise exception 'No active shop or pending deletion exists for this account.';
    end if;
  end if;

  return apprentice_ids;
end;
$$;

create or replace function public.finalize_owner_account_deletion(target_owner_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_profile public.profiles%rowtype;
  apprentice_ids uuid[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted account-deletion service can finalize this deletion.';
  end if;

  select d.apprentice_user_ids
  into apprentice_ids
  from public.owner_account_deletions d
  where d.owner_user_id = target_owner_id;

  if not found then
    raise exception 'No pending account deletion exists for this account.';
  end if;

  select *
  into owner_profile
  from public.profiles
  where id = target_owner_id
  for update;

  if not found then
    return apprentice_ids;
  end if;
  if owner_profile.role <> 'owner'
     or owner_profile.is_active is not true
     or owner_profile.owner_id <> target_owner_id then
    raise exception 'The account is not an active shop owner.';
  end if;

  delete from public.audit_logs where owner_id = target_owner_id;
  delete from public.notifications where owner_id = target_owner_id;
  delete from public.task_reviews where owner_id = target_owner_id;
  delete from public.task_updates where owner_id = target_owner_id;
  delete from public.task_attachments where owner_id = target_owner_id;
  delete from public.tasks where owner_id = target_owner_id;
  delete from public.payments where owner_id = target_owner_id;
  delete from public.order_photos where owner_id = target_owner_id;
  delete from public.orders where owner_id = target_owner_id;
  delete from public.measurement_values where owner_id = target_owner_id;
  delete from public.measurement_sessions where owner_id = target_owner_id;
  delete from public.customer_notes where owner_id = target_owner_id;
  delete from public.customers where owner_id = target_owner_id;
  delete from public.apprentice_training_records where owner_id = target_owner_id;
  delete from public.apprentice_profiles where owner_id = target_owner_id;
  delete from public.measurement_presets where owner_id = target_owner_id;
  delete from public.cloth_gallery_items where owner_id = target_owner_id;
  delete from public.shop_settings where owner_id = target_owner_id;
  delete from public.profiles where owner_id = target_owner_id and id <> target_owner_id;
  delete from public.profiles where id = target_owner_id;

  return apprentice_ids;
end;
$$;

revoke all on function public.prepare_owner_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.finalize_owner_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_owner_account_deletion(uuid) to service_role;
grant execute on function public.finalize_owner_account_deletion(uuid) to service_role;
