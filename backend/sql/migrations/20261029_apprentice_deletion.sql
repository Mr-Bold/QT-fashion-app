create or replace function public.owner_delete_apprentice(
    target_apprentice_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    apprentice_name text;
begin
    if not public.is_active_shop_owner() then
        raise exception 'Only an active shop owner can delete an apprentice.';
    end if;

    select p.full_name
    into apprentice_name
    from public.profiles p
    join public.apprentice_profiles ap on ap.user_id = p.id
    where p.id = target_apprentice_user_id
      and p.owner_id = auth.uid()
      and p.role = 'apprentice'
      and ap.owner_id = auth.uid()
    for update of p, ap;

    if not found then
        if exists (
            select 1
            from public.audit_logs
            where owner_id = auth.uid()
              and action = 'apprentice.deleted'
              and entity_id = target_apprentice_user_id
        ) then
            return;
        end if;

        raise exception 'Apprentice not found in this shop.';
    end if;

    delete from public.tasks
    where owner_id = auth.uid()
      and assigned_to = target_apprentice_user_id;

    delete from public.apprentice_training_records
    where owner_id = auth.uid()
      and apprentice_user_id = target_apprentice_user_id;

    update public.audit_logs
    set actor_id = null
    where owner_id = auth.uid()
      and actor_id = target_apprentice_user_id;

    insert into public.audit_logs (
        owner_id, actor_id, action, entity_type, entity_id, details
    )
    values (
        auth.uid(),
        auth.uid(),
        'apprentice.deleted',
        'apprentice',
        target_apprentice_user_id,
        jsonb_build_object('entity_label', apprentice_name)
    );

    delete from public.apprentice_profiles
    where owner_id = auth.uid()
      and user_id = target_apprentice_user_id;

    delete from public.profiles
    where id = target_apprentice_user_id
      and owner_id = auth.uid()
      and role = 'apprentice';
end;
$$;

revoke all on function public.owner_delete_apprentice(uuid) from public;
revoke execute on function public.owner_delete_apprentice(uuid) from anon;
grant execute on function public.owner_delete_apprentice(uuid) to authenticated;
