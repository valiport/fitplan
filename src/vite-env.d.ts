/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Öffentliche Stripe-Preis-IDs (keine Secrets). Ohne beide: Demo-Checkout. */
  readonly VITE_STRIPE_PRICE_MONTHLY?: string
  readonly VITE_STRIPE_PRICE_YEARLY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
