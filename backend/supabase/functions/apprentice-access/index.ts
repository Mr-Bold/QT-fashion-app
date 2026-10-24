import { createClient } from 'npm:@supabase/supabase-js@2'

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const siteUrl = appSiteUrl
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey || !siteUrl) {
    return response({ error: 'Apprentice access is not configured on the server.' }, 500)
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerError } = await caller.auth.getUser()
  if (callerError || !callerData.user) return response({ error: 'Sign in again before managing apprentice access.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerProfile, error: profileError } = await admin.from('profiles')
    .select('role,is_active,owner_id')
    .eq('id', callerData.user.id)
    .maybeSingle()
  if (profileError) return response({ error: profileError.message }, 500)

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response({ error: 'Request body must be a JSON object.' }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400)
  }

  const action = body.action
  if (action === 'complete_password_setup') {
    if (callerProfile?.role !== 'apprentice' || callerProfile.is_active !== true || !callerProfile.owner_id) {
      return response({ error: 'Only an active apprentice can complete password setup.' }, 403)
    }
    const existingMetadata = callerData.user.app_metadata ?? {}
    const { error } = await admin.auth.admin.updateUserById(callerData.user.id, {
      app_metadata: { ...existingMetadata, password_setup_required: false },
    })
    if (error) return response({ error: error.message }, 400)
    const { error: auditError } = await admin.from('audit_logs').insert({
      owner_id: callerProfile.owner_id,
      actor_id: callerData.user.id,
      action: 'apprentice.password_updated',
      entity_type: 'apprentice',
      entity_id: callerData.user.id,
      details: { entity_label: `${callerData.user.email ?? 'Apprentice'} · password updated` },
    })
    if (auditError) return response({ error: auditError.message }, 500)
    return response({ ok: true })
  }

  if (callerProfile?.role !== 'owner' || callerProfile.is_active !== true || callerProfile.owner_id !== callerData.user.id) {
    return response({ error: 'Only an active shop owner can manage apprentice access.' }, 403)
  }

  if (action === 'delete') {
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return response({ error: 'Choose a valid apprentice account to delete.' }, 400)
    }

    const { error: deletionError } = await caller.rpc('owner_delete_apprentice', {
      target_apprentice_user_id: userId,
    })
    if (deletionError) return response({ error: deletionError.message }, 400)

    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(userId)
    if (authUserError) {
      return response({
        error: `Apprentice records were deleted, but account cleanup could not be checked. Retry deletion: ${authUserError.message}`,
      }, 500)
    }
    if (authUserData.user) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId)
      if (authDeleteError) {
        return response({
          error: `Apprentice records were deleted, but the login account could not be removed. Retry deletion: ${authDeleteError.message}`,
        }, 500)
      }
    }
    return response({ ok: true })
  }

  if (action === 'invite') {
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const specialization = typeof body.specialization === 'string' ? body.specialization.trim() : ''
    const skillLevel = typeof body.skillLevel === 'string' ? body.skillLevel.trim().toLowerCase() : ''
    const startDate = typeof body.startDate === 'string' ? body.startDate : ''
    if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || email.length > 254 || phone.length > 40 || !specialization || specialization.length > 80
      || !['beginner', 'intermediate', 'advanced'].includes(skillLevel)
      || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
      || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) {
      return response({ error: 'Enter a valid name, email, phone, training area, skill level, and start date.' }, 400)
    }
    const { data: existingProfile, error: existingProfileError } = await admin.from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existingProfileError) return response({ error: existingProfileError.message }, 500)
    if (existingProfile) return response({ error: 'An account already uses this email. Use its password-reset link instead.' }, 409)

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${siteUrl}/?apprentice-invite=1`,
        data: { full_name: fullName, phone },
      },
    })
    if (error) return response({ error: error.message }, 400)
    const userId = data.user?.id
    const actionLink = data.properties?.action_link
    if (!userId || !actionLink) return response({ error: 'Supabase did not return a usable invitation link.' }, 502)

    const cleanupIncompleteInvite = async () => {
      const { error: apprenticeCleanupError } = await admin.from('apprentice_profiles').delete().eq('user_id', userId)
      const { error: profileCleanupError } = await admin.from('profiles').delete().eq('id', userId)
      const { error: userCleanupError } = await admin.auth.admin.deleteUser(userId)
      return [apprenticeCleanupError?.message, profileCleanupError?.message, userCleanupError?.message].filter(Boolean).join('; ')
    }
    const { error: userUpdateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(data.user.app_metadata ?? {}), password_setup_required: true },
    })
    if (userUpdateError) {
      const cleanupError = await cleanupIncompleteInvite()
      return response({ error: `${userUpdateError.message}${cleanupError ? ` (Invite cleanup failed: ${cleanupError})` : ''}` }, 500)
    }
    const { error: profileUpdateError } = await admin.from('profiles').update({
      owner_id: callerData.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      role: 'apprentice',
      is_active: true,
    }).eq('id', userId)
    if (profileUpdateError) {
      const cleanupError = await cleanupIncompleteInvite()
      return response({ error: `${profileUpdateError.message}${cleanupError ? ` (Invite cleanup failed: ${cleanupError})` : ''}` }, 500)
    }
    const { error: apprenticeProfileError } = await admin.from('apprentice_profiles').insert({
      owner_id: callerData.user.id,
      user_id: userId,
      start_date: startDate,
      skill_level: skillLevel,
      specialization,
      status: 'active',
    })
    if (apprenticeProfileError) {
      const cleanupError = await cleanupIncompleteInvite()
      return response({ error: `${apprenticeProfileError.message}${cleanupError ? ` (Invite cleanup failed: ${cleanupError})` : ''}` }, 500)
    }
    const { error: auditError } = await admin.from('audit_logs').insert([
      {
        owner_id: callerData.user.id,
        actor_id: callerData.user.id,
        action: 'apprentice.created',
        entity_type: 'apprentice',
        entity_id: userId,
        details: { entity_label: fullName },
      },
      {
        owner_id: callerData.user.id,
        actor_id: callerData.user.id,
        action: 'apprentice.invited',
        entity_type: 'apprentice',
        entity_id: userId,
        details: { entity_label: `${fullName} · ${email}` },
      },
    ])
    if (auditError) {
      const cleanupError = await cleanupIncompleteInvite()
      return response({ error: `${auditError.message}${cleanupError ? ` (Invite cleanup failed: ${cleanupError})` : ''}` }, 500)
    }
    return response({ userId, fullName, email, phone, actionLink })
  }

  if (action === 'password_reset') {
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!userId) return response({ error: 'Choose an apprentice account.' }, 400)
    const { data: profile, error } = await admin.from('profiles')
      .select('email,role,is_active,owner_id')
      .eq('id', userId)
      .eq('owner_id', callerData.user.id)
      .maybeSingle()
    if (error) return response({ error: error.message }, 500)
    if (!profile || profile.role !== 'apprentice' || profile.is_active !== true || !profile.email) {
      return response({ error: 'This apprentice does not have an active email login.' }, 404)
    }
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo: `${siteUrl}/?password-reset=1` },
    })
    if (linkError) return response({ error: linkError.message }, 400)
    const actionLink = linkData.properties?.action_link
    if (!actionLink) return response({ error: 'Supabase did not return a usable password reset link.' }, 502)
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(linkData.user.app_metadata ?? {}), password_setup_required: true },
    })
    if (metadataError) return response({ error: metadataError.message }, 500)
    const { error: auditError } = await admin.from('audit_logs').insert({
      owner_id: callerData.user.id,
      actor_id: callerData.user.id,
      action: 'apprentice.access_reset',
      entity_type: 'apprentice',
      entity_id: userId,
      details: { entity_label: `${profile.email} · password reset link generated` },
    })
    if (auditError) return response({ error: auditError.message }, 500)
    return response({ actionLink, email: profile.email })
  }

  return response({ error: 'Unknown apprentice access action.' }, 400)
})
