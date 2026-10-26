import { createClient } from 'npm:@supabase/supabase-js@2'

const appSiteUrl = (Deno.env.get('APP_SITE_URL') ?? '').replace(/\/+$/, '')
const feedbackRecipient = 'affranyanksontheobald@gmail.com'
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const feedbackFromEmail = Deno.env.get('FEEDBACK_FROM_EMAIL')
  if (!authorization || !supabaseUrl || !anonKey || !appSiteUrl) {
    return response({ error: 'Feedback submission is not configured on the server.' }, 500)
  }
  if (!resendApiKey || !feedbackFromEmail) {
    return response({ error: 'Feedback email delivery is not configured yet.' }, 503)
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerError } = await caller.auth.getUser()
  if (callerError || !callerData.user) {
    return response({ error: 'Sign in again before sending feedback.' }, 401)
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

  const rating = body.rating
  const challenge = typeof body.challenge === 'string' ? body.challenge.trim() : ''
  const suggestions = typeof body.suggestions === 'string' ? body.suggestions.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return response({ error: 'Choose a rating from 1 to 5.' }, 400)
  }
  if (challenge.length > 2000 || suggestions.length > 2000) {
    return response({ error: 'Feedback fields must be 2,000 characters or fewer.' }, 400)
  }
  if (!challenge && !suggestions) {
    return response({ error: 'Describe a challenge or share a feature suggestion.' }, 400)
  }
  if (!/^[+()0-9 .-]{7,40}$/.test(phone)) {
    return response({ error: 'Enter a valid calling or WhatsApp number.' }, 400)
  }

  const userEmail = callerData.user.email ?? 'Not provided'
  const submittedAt = new Date().toISOString()
  const html = [
    '<h2>QT Fashion app feedback</h2>',
    `<p><strong>Rating:</strong> ${rating}/5</p>`,
    `<p><strong>Calling/WhatsApp number:</strong> ${escapeHtml(phone)}</p>`,
    `<p><strong>Account email:</strong> ${escapeHtml(userEmail)}</p>`,
    `<p><strong>Challenge:</strong><br>${escapeHtml(challenge || 'Not provided').replace(/\n/g, '<br>')}</p>`,
    `<p><strong>Feature suggestions:</strong><br>${escapeHtml(suggestions || 'Not provided').replace(/\n/g, '<br>')}</p>`,
    `<p><small>Submitted at ${escapeHtml(submittedAt)}</small></p>`,
  ].join('')
  const text = [
    'QT Fashion app feedback',
    `Rating: ${rating}/5`,
    `Calling/WhatsApp number: ${phone}`,
    `Account email: ${userEmail}`,
    `Challenge:\n${challenge || 'Not provided'}`,
    `Feature suggestions:\n${suggestions || 'Not provided'}`,
    `Submitted at: ${submittedAt}`,
  ].join('\n\n')

  let emailResponse: Response
  try {
    emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: feedbackFromEmail,
        to: [feedbackRecipient],
        ...(callerData.user.email ? { reply_to: callerData.user.email } : {}),
        subject: `QT Fashion app feedback — ${rating}/5`,
        html,
        text,
      }),
    })
  } catch (error) {
    console.error('Feedback email provider request failed.', error)
    return response({ error: 'Could not send feedback right now. Please try again later.' }, 502)
  }

  if (!emailResponse.ok) {
    console.error('Feedback email provider returned an error.', emailResponse.status)
    return response({ error: 'Could not send feedback right now. Please try again later.' }, 502)
  }

  return response({ ok: true })
})
