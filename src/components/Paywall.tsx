// Paywall: Gratis vs. Pro mit zwei Preistarifen (monatlich/jährlich).
// Mit konfigurierten Stripe-Preisen startet der Button den echten
// Stripe-Checkout (usePro); ohne Keys wird der Kauf lokal simuliert.
// Optik: Liquid-Chrome-Glas — Features zweispaltig, Preiskarten mit
// Spar-Badge auf der empfohlenen Jahresoption.

import { useState } from 'react'
import type { BillingInterval } from '../hooks/usePro'
import { stripeAnyPriceConfigured } from '../hooks/usePro'

/** Preisauszeichnung (de-DE). In der Produktion führt Stripe die Beträge. */
const MONTHLY_PRICE = '4,99 €'
const YEARLY_PRICE = '39,99 €'

const PRO_FEATURES = [
  'Übungen an deine Geräte anpassen (Studio, Hanteln, Bänder …)',
  'Keine Übungs-Wiederholung in der Woche — mehr Abwechslung',
  'Wochenplan unbegrenzt neu würfeln',
  'Kalorien-Übersicht & Verlaufsanalyse',
  'Einkaufsliste als Text-Export',
  'Trainingswoche als Kalenderdatei (.ics) exportieren',
  'Gewichts-Verlaufschart mit Trend & Zielprognose',
  'Wochenstatistik: Erfolgsquote & Kalorien-Bilanz',
]

/** Eine auswählbare Preiskarte. */
function PriceCard({ selected, onSelect, badge, title, price, per, note }: {
  selected: boolean
  onSelect: () => void
  badge?: string
  title: string
  price: string
  per: string
  note: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        'relative flex flex-col rounded-[16px] border px-2.5 py-2.5 pt-3 text-left transition ' +
        (selected
          ? 'border-white/50 bg-gradient-to-b from-[#1b5e54]/80 to-[#0c2b26]/85 shadow-[0_4px_18px_rgba(20,150,135,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]'
          : 'border-white/15 bg-white/5 hover:bg-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.3)]')
      }
    >
      {badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-[#ffd98a] to-[#d99a2b] px-2 py-0.5 text-[10px] font-bold text-[#3a2a05] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          {badge}
        </span>
      )}
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#8bada7]">{title}</span>
      <span className="mt-1 flex items-baseline gap-1">
        <span className="text-[20px] font-bold text-[#eaf6f3]">{price}</span>
        <span className="text-[11px] text-[#8bada7]">{per}</span>
      </span>
      <span className="mt-0.5 text-[10px] leading-snug text-[#9fb9b4]">{note}</span>
    </button>
  )
}

export default function Paywall({ onUpgrade }: { onUpgrade: (plan: BillingInterval) => void }) {
  const [interval, setIntervalState] = useState<BillingInterval>('yearly')

  return (
    <div className="glass-panel p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-[#ffcf7e]">🏋 FitPlan Pro</h2>
        <span className="rounded-full border border-[#ffcf7e]/40 bg-[#ffcf7e]/10 px-2 py-0.5 text-[10px] font-bold text-[#ffcf7e]">
          Alle Features freischalten
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-[#8bada7]">
        Du nutzt die Gratis-Version. Pro schaltet alles frei:
      </p>

      <ul className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-0.5 text-[12px] text-[#a9c4be] sm:grid-cols-2">
        {PRO_FEATURES.map((f) => (
          <li key={f} className="flex gap-1.5">
            <span aria-hidden className="shrink-0 text-[#5fe3d4]">✓</span>
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <PriceCard
          title="Monatlich"
          price={MONTHLY_PRICE}
          per="/Monat"
          note="Flexibel, monatlich kündbar."
          selected={interval === 'monthly'}
          onSelect={() => setIntervalState('monthly')}
        />
        <PriceCard
          title="Jährlich"
          price={YEARLY_PRICE}
          per="/Jahr"
          note="entspricht 3,33 €/Monat — 2 Monate gratis"
          badge="Beste Wahl · spar 33 %"
          selected={interval === 'yearly'}
          onSelect={() => setIntervalState('yearly')}
        />
      </div>

      <button
        onClick={() => onUpgrade(interval)}
        className="glass-btn glass-btn-primary mt-2 w-full !py-2 !text-[13px]"
      >
        {interval === 'yearly'
          ? `Pro freischalten – ${YEARLY_PRICE} / Jahr`
          : `Pro freischalten – ${MONTHLY_PRICE} / Monat`}
      </button>

      <p className="mt-1 text-center text-[10px] text-[#8bada7]">
        Jederzeit kündbar ·{' '}
        {stripeAnyPriceConfigured
          ? 'Sichere Zahlung über Stripe.'
          : 'Demo: Kauf wird lokal simuliert. In der Produktion: Stripe-Checkout.'}
      </p>
    </div>
  )
}
