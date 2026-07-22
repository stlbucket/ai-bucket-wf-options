import { defineEventHandler, readBody, createError } from 'h3'

// Unauthenticated "forgot password" route (password-self-service spec, forgot-password.data.md).
// The home-page /forgot-password page posts an email; we fire the n8n forgot-password workflow
// (the second half of invite-user: search ZITADEL by email -> password_reset -> set-password email).
//
// Anti-enumeration: this route ALWAYS responds 200 for a well-formed email, regardless of whether a
// ZITADEL user exists — the workflow decides silently whether to send (it returns [] for unknown
// users). A 502 is only for a webhook-transport failure, which is identical for every email and so
// leaks nothing. This is NOT triggerWorkflow (that is claims-gated; forgot-password is pre-login):
// the shared secret is held server-side and never reaches the browser (same as request-password).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event)
  const email = body?.email?.trim()
  // Format-only validation; existence is NEVER checked here (that would be the enumeration oracle).
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, data: { error: 'invalid' } })
  }

  const n8nUrl = process.env.N8N_INTERNAL_URL
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!n8nUrl || !secret) throw createError({ statusCode: 502, data: { error: 'unavailable' } })

  // NB: use the service name; localhost -> ::1 and n8n listens IPv4-only (invite-user lesson).
  try {
    await $fetch(`${n8nUrl}/webhook/forgot-password`, {
      method: 'POST',
      headers: { 'x-fnb-webhook-secret': secret },
      body: { email },
    })
  } catch {
    // Webhook unreachable / non-2xx — same failure for every email, so no enumeration signal.
    throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  }

  // Always 200 for a well-formed email — the page shows the same generic "if an account exists…".
  return { ok: true }
})
