import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const appSiteUrl = (Deno.env.get('APP_SITE_URL') ?? '').replace(/\/+$/, '')
const corsHeaders = {
  'Access-Control-Allow-Origin': appSiteUrl,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function listOwnerFiles(
  admin: SupabaseClient,
  bucket: string,
  ownerId: string,
  folder = '',
): Promise<string[]> {
  const files: string[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Could not inspect stored ${bucket} files: ${error.message}`)
    if (!data.length) break

    for (const entry of data) {
      const path = folder ? `${folder}/${entry.name}` : entry.name
      if (entry.id === null && entry.metadata === null) {
        files.push(...await listOwnerFiles(admin, bucket, ownerId, path))
      } else {
        files.push(path)
      }
    }
    offset += data.length
  }

  return files
}

async function removeOwnerFiles(
  admin: SupabaseClient,
  bucket: string,
  ownerId: string,
): Promise<void> {
  const files = await listOwnerFiles(admin, bucket, ownerId, ownerId)
  for (let start = 0; start < files.length; start += 100) {
    const { error } = await admin.storage.from(bucket).remove(files.slice(start, start + 100))
    if (error) throw new Error(`Could not remove stored ${bucket} files: ${error.message}`)
  }
}

async function deleteAuthUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error && error.status !== 404) {
    throw new Error(`Could not verify an account being removed: ${error.message}`)
  }
  if (!data?.user) return

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) throw new Error(`Could not delete an account: ${deleteError.message}`)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey || !appSiteUrl) {
    return response({ error: 'Owner account deletion is not configured on the server.' }, 500)
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerError } = await caller.auth.getUser()
  if (callerError || !callerData.user?.email) {
    return response({ error: 'Sign in again before deleting this shop.' }, 401)
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response({ error: 'Request body must be a JSON object.' }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400)
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (!password || password.length > 1024 || body.confirmation !== 'DELETE MY SHOP') {
    return response({ error: 'Enter your password and type DELETE MY SHOP to confirm.' }, 400)
  }

  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verifiedData, error: verificationError } = await verifier.auth.signInWithPassword({
    email: callerData.user.email,
    password,
  })
  if (verificationError || verifiedData.user?.id !== callerData.user.id) {
    return response({ error: 'The password is incorrect. The shop was not deleted.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const ownerId = callerData.user.id
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_active,owner_id')
    .eq('id', ownerId)
    .maybeSingle()
  if (profileError) return response({ error: `Could not verify shop ownership: ${profileError.message}` }, 500)

  const { data: pendingDeletion, error: pendingError } = await admin
    .from('owner_account_deletions')
    .select('owner_user_id')
    .eq('owner_user_id', ownerId)
    .maybeSingle()
  if (pendingError) {
    return response({
      error: `Account deletion is not ready. Apply its database migration first: ${pendingError.message}`,
    }, 500)
  }
  if (profile) {
    if (profile.role !== 'owner' || profile.is_active !== true || profile.owner_id !== ownerId) {
      return response({ error: 'Only the active owner of this shop can delete it.' }, 403)
    }
  } else if (!pendingDeletion) {
    return response({ error: 'This account does not own an active shop or have a pending deletion.' }, 403)
  }

  const { data: apprenticeIds, error: prepareError } = await admin.rpc(
    'prepare_owner_account_deletion',
    { target_owner_id: ownerId },
  )
  if (prepareError) return response({ error: `Could not prepare shop deletion: ${prepareError.message}` }, 500)

  try {
    await removeOwnerFiles(admin, 'customer-photos', ownerId)
    await removeOwnerFiles(admin, 'cloth-gallery', ownerId)
  } catch (error) {
    return response({
      error: error instanceof Error
        ? `${error.message} No database records or login accounts were deleted; some photos may already have been removed. Retry this action after resolving the storage issue.`
        : 'Could not remove shop photos. No database records or login accounts were deleted; some photos may already have been removed. Retry this action.',
    }, 500)
  }

  const { data: finalizedApprenticeIds, error: finalizeError } = await admin.rpc(
    'finalize_owner_account_deletion',
    { target_owner_id: ownerId },
  )
  if (finalizeError) {
    return response({
      error: `Shop photos were removed, but shop records could not be finalized: ${finalizeError.message}. Retry this action.`,
    }, 500)
  }

  const accountIds = Array.isArray(finalizedApprenticeIds)
    ? finalizedApprenticeIds
    : Array.isArray(apprenticeIds)
      ? apprenticeIds
      : []
  try {
    for (const apprenticeId of accountIds) {
      if (typeof apprenticeId === 'string') await deleteAuthUser(admin, apprenticeId)
    }
    await deleteAuthUser(admin, ownerId)
  } catch (error) {
    return response({
      error: error instanceof Error
        ? `${error.message} Shop data has been removed. Retry this action to finish deleting the login accounts.`
        : 'Shop data has been removed, but account deletion did not finish. Retry this action.',
    }, 500)
  }

  return response({ ok: true })
})
