// Netlify Function: Stripe-Webhook → pflegt `public.subscriptions` in Supabase.
//
// Konfiguration (Netlify Dashboard → Environment variables):
//   STRIPE_SECRET_KEY            — wie bei create-checkout-session
//   STRIPE_WEBHOOK_SECRET        — Signatur-Secret (whsec_…)
//   SUPABASE_URL                 — Projekt-URL
//   SUPABASE_SERVICE_ROLE_KEY    — service_role! Überschreibt RLS. Nur serverseitig.
//
// Event-Flow (idempotent — Upserts, keine Duplikate):
//   checkout.session.completed → Sub-Zeile anlegen/aktualisieren
//   customer.subscription.updated → Status/Zeitraum nachziehen
//   customer.subscription.deleted → status = 'canceled'
//
// Wichtig: Die Signal-Verifikation lehnt Anfragen ohne gültige Stripe-
// Signatur ab; ohne konfiguriertes Secret antwortet die Function mit 503,
// damit niemand die Entitlement-Tabelle faken kann.

import Stripe from 'stripe'

export default async (req: Request) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json(503, { error: 'Stripe-Webhook ist nicht konfiguriert.' })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return json(400, { error: 'Fehlende Stripe-Signatur.' })
  }

  const stripe = new Stripe(stripeKey)
  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret)
  } catch {
    return json(400, { error: 'Ungültige Signatur.' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId =
      session.client_reference_id ??
      session.metadata?.['supabase_user_id'] ??
      null
    const customer = typeof session.customer === 'string' ? session.customer : null
    const subscription =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : null
    if (userId && subscription) {
      await upsertSubscription(supabaseUrl, serviceRoleKey, userId, customer, subscription)
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const userId =
      subscription.metadata?.['supabase_user_id'] ??
      (typeof subscription.customer === 'string'
        ? await supabaseUserIdForCustomer(supabaseUrl, serviceRoleKey, subscription.customer)
        : null)
    if (userId) {
      await upsertSubscription(supabaseUrl, serviceRoleKey, userId, subscription.customer, subscription)
    }
  }

  return json(200, { received: true })
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Schreibt den Abo-Stand in public.subscriptions (idempotenter Upsert). */
async function upsertSubscription(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  customer: string | null,
  subscription: Stripe.Subscription,
): Promise<void> {
  const canceled =
    subscription.status === 'canceled' ||
    subscription.ended_at != null
  const periodEndSeconds =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? subscription.current_period_end
      : (subscription.ended_at ?? subscription.current_period_end)

  await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      stripe_customer_id: typeof customer === 'string' ? customer : null,
      stripe_subscription_id: subscription.id,
      status: canceled ? 'canceled' : subscription.status,
      price_id: subscription.items.data[0]?.price?.id ?? null,
      interval: subscription.items.data[0]?.price?.recurring?.interval ?? null,
      current_period_end:
        typeof periodEndSeconds === 'number' ? new Date(periodEndSeconds * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  })
}

/** Ermittelt die Supabase-User-ID anhand der Stripe-Kunden-ID (Fallback-Weg). */
async function supabaseUserIdForCustomer(
  supabaseUrl: string,
  serviceRoleKey: string,
  customerId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id&limit=1`,
      {
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      },
    )
    if (!res.ok) return null
    const rows: unknown = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const id = (rows[0] as { user_id?: unknown }).user_id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

export const config = { path: '/api/stripe-webhook' }
