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

  // Ordnungs-Zeitstempel des Events: verspätete Retries dürfen keinen
  // neueren Abo-Stand zurückschreiben (z. B. 'canceled' von 'active'
  // überschrieben → Gratis-Pro trotz Kündigung).
  const eventAt = new Date(event.created * 1000).toISOString()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    // Nur Abo-Checkouts sind hier relevant; andere Modi (payment/setup)
    // werden bewusst ignoriert.
    if (session.mode === 'subscription') {
      const userId =
        session.client_reference_id ??
        session.metadata?.['supabase_user_id'] ??
        null
      const customer = typeof session.customer === 'string' ? session.customer : null
      const subscription =
        typeof session.subscription === 'string'
          ? await stripe.subscriptions.retrieve(session.subscription)
          : (typeof session.subscription === 'object' && session.subscription !== null
            ? session.subscription
            : null)
      if (!userId || !subscription) {
        // Nie still verwerfen: ein zahlender Kunde ohne zuordenbare Zeile
        // muss als fehlgeschlagenes Event sichtbar bleiben (500 → Retry).
        throw new Error(
          `checkout.session.completed ${event.id}: Supabase-User oder Abo fehlt — nicht zuordenbar.`,
        )
      }
      await upsertSubscription(supabaseUrl, serviceRoleKey, userId, customer, subscription, eventAt)
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const userId =
      subscription.metadata?.['supabase_user_id'] ??
      (typeof subscription.customer === 'string'
        ? await supabaseUserIdForCustomer(supabaseUrl, serviceRoleKey, subscription.customer)
        : null)
    if (!userId) {
      // Retry kann hier helfen (z. B. checkout-Event noch nicht verarbeitet):
      // bewusst werfen statt still zu verlieren.
      throw new Error(
        `${event.type} ${event.id}: Kein Supabase-User für Kunde ${String(subscription.customer)} — nicht zuordenbar.`,
      )
    }
    await upsertSubscription(
      supabaseUrl,
      serviceRoleKey,
      userId,
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
      subscription,
      eventAt,
    )
  }

  return json(200, { received: true })
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Schreibt den Abo-Stand in public.subscriptions.
 * Reihenfolge-sicher: Das Event wird nur übernommen, wenn kein neueres Event
 * bereits geschrieben hat (Guard auf last_event_at). Duplikate sind dadurch
 * idempotent, verspätete Retries harmlos.
 */
async function upsertSubscription(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  customer: string | null,
  subscription: Stripe.Subscription,
  eventAt: string,
): Promise<void> {
  const canceled =
    subscription.status === 'canceled' ||
    subscription.ended_at != null
  // Seit Stripe-API v2025-03 sitzt current_period_end auf dem SubscriptionItem.
  const itemPeriodEnd = subscription.items.data[0]?.current_period_end ?? null
  const periodEndSeconds =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? itemPeriodEnd
      : (subscription.ended_at ?? itemPeriodEnd)

  const row = {
    user_id: userId,
    stripe_customer_id: typeof customer === 'string' ? customer : null,
    stripe_subscription_id: subscription.id,
    status: canceled ? 'canceled' : subscription.status,
    price_id: subscription.items.data[0]?.price?.id ?? null,
    interval: subscription.items.data[0]?.price?.recurring?.interval ?? null,
    current_period_end:
      typeof periodEndSeconds === 'number' ? new Date(periodEndSeconds * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
    last_event_at: eventAt,
  }
  const headers = {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'content-type': 'application/json',
  }

  // 1) Bedingtes Update: greift nur, wenn noch kein neueres Event geschrieben
  //    hat. `last_event_at.lte.` inkludiert Duplikate desselben Events
  //    (idempotent, gleicher Inhalt).
  const guard = encodeURIComponent(`(last_event_at.is.null,last_event_at.lte.${eventAt})`)
  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&or=${guard}`,
    {
      method: 'PATCH',
      headers: { ...headers, prefer: 'return=representation' },
      body: JSON.stringify(row),
    },
  )
  if (!patchRes.ok) {
    const detail = await patchRes.text().catch(() => '')
    throw new Error(`Supabase-Update fehlgeschlagen (${patchRes.status}): ${detail}`)
  }
  const patched: unknown = await patchRes.json()
  if (Array.isArray(patched) && patched.length > 0) return

  // 2) Keine Zeile getroffen: existiert bereits eine (→ Event ist veraltet,
  //    bewusst nicht schreiben) oder noch keine (→ anlegen)?
  const headRes = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
    { headers },
  )
  if (!headRes.ok) {
    const detail = await headRes.text().catch(() => '')
    throw new Error(`Supabase-Abfrage fehlgeschlagen (${headRes.status}): ${detail}`)
  }
  const existing: unknown = await headRes.json()
  if (Array.isArray(existing) && existing.length > 0) {
    // Ein neueres Event hat bereits geschrieben — dieses ist überholt.
    return
  }

  // 3) Erste Zeile anlegen (Duplikat-Race: Upsert bleibt idempotent).
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { ...headers, prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row),
  })
  // Fehler nicht verschweigen: ein 200 hier würde Stripe vom Retry abhalten
  // und der zahlende Kunde bliebe dauerhaft ohne Pro.
  if (!insertRes.ok) {
    const detail = await insertRes.text().catch(() => '')
    throw new Error(`Supabase-Upsert fehlgeschlagen (${insertRes.status}): ${detail}`)
  }
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
