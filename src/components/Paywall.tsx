// Paywall (MVP-Mock): erklärt Gratis vs. Pro. Der Upgrade-Button simuliert
// den Kauf; in Produktion ersetzt durch Store-SDK (z. B. RevenueCat) bzw.
// Stripe-Checkout + Webhook-Entitlement.

export default function Paywall({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-gray-800/60 p-6 text-left">
      <h2 className="text-xl font-semibold text-gray-100">FitPlan Pro</h2>
      <p className="mt-1 text-sm text-gray-400">
        Du nutzt die Gratis-Version. Pro schaltet alles frei:
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-gray-300">
        <li>✓ Mehr Rezepte pro Mahlzeit (24 statt 5)</li>
        <li>✓ Wochenplan unbegrenzt neu würfeln</li>
        <li>✓ Kalorien-Übersicht & Verlaufsanalyse</li>
        <li>✓ Einkaufsliste als Text-Export</li>
      </ul>
      <button
        onClick={onUpgrade}
        className="mt-4 w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-medium text-gray-950 transition hover:bg-cyan-400"
      >
        Pro freischalten (Demo)
      </button>
      <p className="mt-2 text-xs text-gray-500">
        Demo: Kauf wird lokal simuliert. In der Produktion: RevenueCat/Stripe.
      </p>
    </div>
  )
}
