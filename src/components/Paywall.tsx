// Paywall (MVP-Mock): erklärt Gratis vs. Pro. Der Upgrade-Button simuliert
// den Kauf; in Produktion ersetzt durch Store-SDK (z. B. RevenueCat) bzw.
// Stripe-Checkout + Webhook-Entitlement. Optik: Liquid-Glass-Karte.

export default function Paywall({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="glass-panel p-3 text-left">
      <h2 className="text-[14px] font-bold text-[#ffcf7e]">🏋 FitPlan Pro</h2>
      <p className="mt-0.5 text-[12px] text-[#8bada7]">
        Du nutzt die Gratis-Version. Pro schaltet alles frei:
      </p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px] text-[#a9c4be]">
        <li>✓ Übungen an deine Geräte anpassen (Studio, Hanteln, Bänder …)</li>
        <li>✓ Keine Übungs-Wiederholung in der Woche — mehr Abwechslung</li>
        <li>✓ Wochenplan unbegrenzt neu würfeln</li>
        <li>✓ Kalorien-Übersicht & Verlaufsanalyse</li>
        <li>✓ Einkaufsliste als Text-Export</li>
      </ul>
      <button
        onClick={onUpgrade}
        className="glass-btn glass-btn-primary mt-2 w-full !py-2 !text-[13px]"
      >
        Pro freischalten (Demo)
      </button>
      <p className="mt-1 text-[10px] text-[#8bada7]">
        Demo: Kauf wird lokal simuliert. In der Produktion: RevenueCat/Stripe.
      </p>
    </div>
  )
}
