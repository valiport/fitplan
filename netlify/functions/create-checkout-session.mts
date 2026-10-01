// Netlify Function: erstellt eine Stripe-Checkout-Session für FitPlan Pro.
//
// Konfiguration (Netlify Dashboard → Site configuration → Environment variables):
//   STRIPE_SECRET_KEY        — Geheimer Stripe-Key (niemals ins Frontend!)
//   STRIPE_PRICE_MONTHLY     — Preis-ID des Monatarifs (price_…)
//   STRIPE_PRICE_YEARLY      — Preis-ID des Jahresrufs (price_…)
//   SUPABASE_URL             — Projekt-URL (für den Redirect nach dem Checkout)
//   STRIPE_WEBHOOK_SECRET    — Signatur-Secret für stripe-webhook (nur dort nötig)
//
// Optional: SUPABASE_SERVICE_ROLE_KEY — dann trägt die Function die Zuordnung
// Stripe-Kunde ↔ Supabase-User selbst ein (sonst macht es der Webhook per
// client_reference_id). Beide Wege sind idempotent.
//
// Auth: Der Aufrufer schickt den Supabase-Access-Token als Bearer; wir prüfen
// ihn direkt gegen Supabase (kein Vertrauen in Client-Angaben).

import Stripe from 'stripe'

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY
  const priceYearly = process.env.STRIPE_PRICE_YEARLY
  const supabaseUrl = process.env.SUPABASE_URL

  if (!stripeKey || !priceMonthly || !priceYearly) {
    return json(503, { error: 'Stripe ist nicht konfiguriert.' })
  }

  // 1) User aus dem Bearer-Token ermitteln (verhindert fremde E-Mails/IDs).
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const user = token ? await supabaseUser(supabaseUrl, token) : null
  if (!supabaseUrl || !user) {
    return json(401, { error: 'Nicht angemeldet.' })
  }

  // 2) Gewählten Tarif auflösen (nur bekannte Intervalle zulassen — sonst
  // würde ein unbekanntes Feld still auf das Jahresabo fallen).
  let body: { interval?: unknown }
  try {
    body = (await req.json()) as { interval?: unknown }
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' })
  }
  if (body.interval !== 'monthly' && body.interval !== 'yearly') {
    return json(400, { error: 'Ungültiges Abonnement-Intervall.' })
  }
  const priceId = body.interval === 'monthly' ? priceMonthly : priceYearly

  // 3–4) Stripe-Aufrufe abfangen: Ausfälle sauber melden statt roher 500er.
  const stripe = new Stripe(stripeKey)
  try {
    const existing = await stripe.customers.list({ email: user.email, limit: 1 })
    const customer =
      existing.data[0] ??
      (await stripe.customers.create({
        email: user.email,
        'metadata[supabase_user_id]': user.id,
      }))

    // Checkout-Session: Abo-Modus, client_reference_id = Supabase-User.
    const siteUrl = process.env.URL ?? 'http://localhost:5173'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
    })

    if (!session.url) {
      return json(500, { error: 'Checkout-Session ohne URL.' })
    }
    return json(200, { url: session.url })
  } catch {
    return json(502, { error: 'Zahlungsdienst derzeit nicht erreichbar. Bitte später erneut versuchen.' })
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface SupabaseUser {
  id: string
  email: string
}

/** Prüft einen Supabase-Access-Token und liefert User-ID + E-Mail. */
async function supabaseUser(supabaseUrl: string | undefined, token: string): Promise<SupabaseUser | null> {
  if (!supabaseUrl) return null
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return null
    const { id, email } = data as { id?: unknown; email?: unknown }
    if (typeof id !== 'string' || typeof email !== 'string') return null
    return { id, email }
  } catch {
    return null
  }
}

export const config = { path: '/api/create-checkout-session' }
