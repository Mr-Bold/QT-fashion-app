create or replace function public.owner_delete_customer(
    target_customer_id uuid
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
    customer_name text;
    order_ids uuid[];
    task_ids uuid[];
    measurement_ids uuid[];
    customer_note_ids uuid[];
    payment_ids uuid[];
    related_entity_ids uuid[];
    photo_paths text[];
begin
    if not public.is_active_shop_owner() then
        raise exception 'Only an active shop owner can delete customer records.';
    end if;

    select c.full_name
    into customer_name
    from public.customers c
    where c.id = target_customer_id
      and c.owner_id = auth.uid()
    for update;

    if not found then
        raise exception 'Customer not found in this shop.';
    end if;

    select coalesce(array_agg(o.id), array[]::uuid[])
    into order_ids
    from public.orders o
    where o.owner_id = auth.uid()
      and o.customer_id = target_customer_id;

    select coalesce(array_agg(t.id), array[]::uuid[])
    into task_ids
    from public.tasks t
    where t.owner_id = auth.uid()
      and t.order_id = any(order_ids);

    select coalesce(array_agg(ms.id), array[]::uuid[])
    into measurement_ids
    from public.measurement_sessions ms
    where ms.owner_id = auth.uid()
      and ms.customer_id = target_customer_id;

    select coalesce(array_agg(cn.id), array[]::uuid[])
    into customer_note_ids
    from public.customer_notes cn
    where cn.owner_id = auth.uid()
      and cn.customer_id = target_customer_id;

    select coalesce(array_agg(p.id), array[]::uuid[])
    into payment_ids
    from public.payments p
    where p.owner_id = auth.uid()
      and p.order_id = any(order_ids);

    related_entity_ids := array[ target_customer_id ] || order_ids || task_ids
        || measurement_ids || customer_note_ids || payment_ids;

    select coalesce(array_agg(distinct stored_photos.path), array[]::text[])
    into photo_paths
    from (
        select c.photo_path as path
        from public.customers c
        where c.id = target_customer_id
          and c.owner_id = auth.uid()

        union all

        select unnest(coalesce(ms.garment_photo_paths, array[]::text[])
            || coalesce(ms.style_photo_paths, array[]::text[])) as path
        from public.measurement_sessions ms
        where ms.owner_id = auth.uid()
          and ms.customer_id = target_customer_id

        union all

        select op.storage_path as path
        from public.order_photos op
        where op.owner_id = auth.uid()
          and op.order_id = any(order_ids)
    ) stored_photos
    where stored_photos.path is not null
      and stored_photos.path <> ''
      and stored_photos.path not like '/%'
      and split_part(stored_photos.path, '/', 1) = auth.uid()::text;

    delete from public.audit_logs
    where owner_id = auth.uid()
      and entity_id = any(related_entity_ids);

    delete from public.notifications
    where owner_id = auth.uid()
      and related_task_id = any(task_ids);

    update public.measurement_sessions
    set previous_session_id = null
    where owner_id = auth.uid()
      and previous_session_id = any(measurement_ids);

    delete from public.tasks
    where owner_id = auth.uid()
      and id = any(task_ids);

    delete from public.payments
    where owner_id = auth.uid()
      and order_id = any(order_ids);

    delete from public.orders
    where owner_id = auth.uid()
      and id = any(order_ids);

    delete from public.measurement_sessions
    where owner_id = auth.uid()
      and id = any(measurement_ids);

    delete from public.customers
    where owner_id = auth.uid()
      and id = target_customer_id;

    insert into public.audit_logs (
        owner_id, actor_id, action, entity_type, entity_id, details
    )
    values (
        auth.uid(),
        auth.uid(),
        'customer.deleted',
        'customer',
        target_customer_id,
        jsonb_build_object('entity_label', customer_name)
    );

    return photo_paths;
end;
$$;

revoke all on function public.owner_delete_customer(uuid) from public;
revoke execute on function public.owner_delete_customer(uuid) from anon;
grant execute on function public.owner_delete_customer(uuid) to authenticated;
