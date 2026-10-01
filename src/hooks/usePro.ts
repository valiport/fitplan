// Pro-Entitlement — die EINE Stelle, die über den Pro-Status entscheidet.
//
// Zwei Quellen, klar getrennt:
//  1. Stripe (Produktion): Der Upgrade-Button startet eine Stripe-Checkout-
//     Session über die Netlify-Function `create-checkout-session`. Der
//     Stripe-Webhook (`stripe-webhook`) pflegt danach `public.subscriptions`
//     in Supabase — dieser Hook liest sie und schaltet Pro auf jedem Gerät frei.
//  2. Demo-Fallback: Solange keine Stripe-Preis-IDs konfiguriert sind, wird
//     der Kauf lokal simuliert (localStorage), damit die App testbar bleibt.
//
// Die Entitlement-Prüfung bleibt an dieser einen Stelle — UI-Komponenten
// bekommen nur `isPro`/`upgrade`/`reset` hereingereicht.

import { useCallback, useEffect, useState } from 'react'
import { loadJson, saveJson } from '../domain/storage'
import { supabase } from '../lib/supabase'

/** Bezahlbarer Zeitraum eines Pro-Abos. */
export type BillingInterval = 'monthly' | 'yearly'

const KEY = 'fitplanner.pro.v1'

// Öffentliche Stripe-Preis-IDs (Preis-IDs sind keine Secrets).
const priceMonthly = import.meta.env.VITE_STRIPE_PRICE_MONTHLY?.trim()
const priceYearly = import.meta.env.VITE_STRIPE_PRICE_YEARLY?.trim()

/** true, sobald mindestens EIN echter Stripe-Preis gesetzt ist → nie Demo-Kauf. */
export const stripeAnyPriceConfigured = Boolean(priceMonthly || priceYearly)

/** true, wenn BEIDE Preise gesetzt sind (volle Konfiguration). */
export const stripeCheckoutConfigured = Boolean(priceMonthly && priceYearly)

export function usePro() {
  // Parser akzeptiert nur literal true; alles andere (inkl. false/korrupt) = Gratis.
  const [isPro, setIsPro] = useState<boolean>(
    () => loadJson(KEY, (raw) => (raw === true ? true : null)) === true,
  )

  // Cloud-Entitlement: Der Stripe-Webhook pflegt public.subscriptions.
  // Ein aktiver Eintrag schaltet Pro frei — auch auf neuen Geräten.
  // Nur aufwerten, nie herabstufen (Demo-Pro bleibt bestehen, bis reset() läuft).
  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    const load = async () => {
      try {
        const { data } = await client
          .from('subscriptions')
          .select('status, current_period_end')
          .maybeSingle()
        if (!active || !data || data.status !== 'active') return
        if (data.current_period_end && new Date(data.current_period_end).getTime() < Date.now()) return
        setIsPro(true)
      } catch {
        /* Entitlement-Fallback: lokal bleibt, wie es ist. */
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const upgrade = useCallback(async (plan: BillingInterval = 'yearly') => {
    // Teilweise konfiguriert: KEIN Demo-Fallback — sonst käme ein Nutzer
    // ohne Zahlung an Pro, obwohl echte Preise gesetzt sind.
    if (stripeAnyPriceConfigured && !stripeCheckoutConfigured) {
      throw new Error('Der Kauf ist noch nicht verfügbar: Es fehlt ein Stripe-Preis in der Konfiguration.')
    }
    if (stripeCheckoutConfigured) {
      if (!supabase) throw new Error('Der Kauf benötigt eine Cloud-Verbindung. Bitte später erneut versuchen.')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Bitte zuerst anmelden.')
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ interval: plan }),
      })
      if (!res.ok) throw new Error('Der Checkout konnte nicht gestartet werden. Bitte später erneut versuchen.')
      const body: unknown = await res.json()
      const url =
        typeof body === 'object' && body !== null && 'url' in body
          ? (body as { url?: unknown }).url
          : undefined
      if (typeof url !== 'string' || !url.startsWith('https://checkout.stripe.com/')) {
        throw new Error('Der Checkout konnte nicht gestartet werden. Bitte später erneut versuchen.')
      }
      window.location.assign(url)
      return
    }

    // Demo-Fallback: Kauf lokal simulieren.
    saveJson(KEY, true)
    setIsPro(true)
  }, [])

  const reset = useCallback(() => {
    saveJson(KEY, false)
    setIsPro(false)
  }, [])

  return { isPro, upgrade, reset }
}
