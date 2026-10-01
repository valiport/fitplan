// Marktplatz-Tab: eigene Platten verkaufen, fremde Angebote filtern &
// kaufen, Transaktionshistorie + Kontostand. Cloud-seitig atomar (RPC);
// ohne Supabase nur Ansehen (Hinweis im UI).

import { useMemo, useState } from 'react'
import { getPlate, MIN_PRICE, RARITY_LABELS, RARITY_ORDER, formatWeight } from '../domain/plates'
import { RarityBadge } from './PlateIcon'
import { XpButton, XpGroupBox } from './ui'
import type { MarketListing, MarketTransaction, useMarket } from '../hooks/useCollectionSocial'
import type { Inventory } from '../domain/plates'
import type { Rarity } from '../domain/plates'

export default function MarketView({ coins, inventory, marketApi, onChanged, onError }: {
  coins: number
  inventory: Inventory
  marketApi: ReturnType<typeof useMarket>
  /** Wallet/Inventar nach atomarer Cloud-Transaktion neu laden. */
  onChanged: () => void
  onError: (message: string) => void
}) {
  const [sellPlateId, setSellPlateId] = useState('')
  const [sellPrice, setSellPrice] = useState<number>(0)
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortByPrice, setSortByPrice] = useState<'asc' | 'desc'>('asc')
  const [busy, setBusy] = useState(false)

  const sellable = Object.entries(inventory).filter(([, qty]) => qty > 0)
  const sellPlate = sellPlateId ? getPlate(sellPlateId) : null

  const filtered = useMemo(() => {
    let list: MarketListing[] = [...marketApi.listings]
    if (rarityFilter !== 'all') list = list.filter((l) => getPlate(l.plateId)?.rarity === rarityFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((l) => (getPlate(l.plateId)?.name ?? l.plateId).toLowerCase().includes(q))
    }
    list.sort((a, b) => (sortByPrice === 'asc' ? a.price - b.price : b.price - a.price))
    return list
  }, [marketApi.listings, rarityFilter, search, sortByPrice])

  const sell = async () => {
    if (!sellPlate) {
      onError('Bitte zuerst eine Platte auswählen.')
      return
    }
    setBusy(true)
    try {
      await marketApi.createListing(sellPlate.id, sellPrice)
      onChanged()
      setSellPlateId('')
      setSellPrice(0)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Verkauf fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const buy = async (listing: MarketListing) => {
    if (listing.price > coins) {
      onError('Nicht genug Coins für dieses Angebot.')
      return
    }
    setBusy(true)
    try {
      await marketApi.buyListing(listing.id)
      onChanged()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Kauf fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-left">
      {/* Kontostand */}
      <div className="glass-inset mb-2 flex items-center justify-between px-2.5 py-2">
        <span className="text-[12px] font-bold text-[#ffcf7e]">🪙 Kontostand</span>
        <span className="text-[15px] font-bold tabular-nums text-[#ffcf7e]">
          {coins.toLocaleString('de-DE')} Coins
        </span>
      </div>

      {/* Verkauf */}
      <XpGroupBox title="Platte anbieten">
        {sellable.length === 0 ? (
          <p className="text-[12px] text-[#8bada7]">Inventar leer — erst Platten sammeln!</p>
        ) : (
          <>
            <div className="flex gap-1.5">
              <select
                value={sellPlateId}
                onChange={(e) => {
                  setSellPlateId(e.target.value)
                  const plate = getPlate(e.target.value)
                  setSellPrice(plate ? MIN_PRICE[plate.rarity] : 0)
                }}
                className="glass-select min-w-0 flex-1"
                aria-label="Zu verkaufende Platte"
              >
                <option value="">— Platte wählen —</option>
                {sellable.map(([plateId, qty]) => (
                  <option key={plateId} value={plateId}>
                    {getPlate(plateId)?.name ?? plateId} (×{qty})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={sellPlate ? MIN_PRICE[sellPlate.rarity] : 0}
                step={1}
                value={sellPrice || ''}
                onChange={(e) => setSellPrice(Number(e.target.value))}
                placeholder="Preis"
                aria-label="Verkaufspreis in Coins"
                className="glass-input !w-24"
              />
            </div>
            {sellPlate && (
              <p className="mt-1 text-[11px] text-[#8bada7]">
                Mindestpreis ({RARITY_LABELS[sellPlate.rarity]}): {MIN_PRICE[sellPlate.rarity].toLocaleString('de-DE')} Coins
              </p>
            )}
            <XpButton
              variant="primary"
              className="mt-1.5 w-full"
              disabled={busy || !sellPlate || sellPrice < (sellPlate ? MIN_PRICE[sellPlate.rarity] : 0)}
              onClick={() => void sell()}
            >
              Zum Verkauf anbieten
            </XpButton>
          </>
        )}
      </XpGroupBox>

      {/* Eigene aktive Angebote */}
      {marketApi.ownListings.length > 0 && (
        <XpGroupBox title="Meine Angebote" className="mt-2">
          <ul className="space-y-1">
            {marketApi.ownListings.map((listing) => {
              const plate = getPlate(listing.plateId)
              if (!plate) return null
              return (
                <li key={listing.id} className="glass-inset flex items-center gap-2 p-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-[#eaf6f3]">{plate.name}</span>
                    <span className="block text-[10px] text-[#8bada7]">{formatWeight(plate.weightKg)} · eingestellt am {listing.createdAt.slice(0, 10)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#ffcf7e]">
                    {listing.price.toLocaleString('de-DE')} 🪙
                  </span>
                  <XpButton
                    variant="danger"
                    className="!px-2 !py-1 !text-[11px]"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true)
                      void marketApi.cancelListing(listing.id).then(() => {
                        onChanged()
                      }).catch((cause: unknown) => {
                        onError(cause instanceof Error ? cause.message : 'Angebot konnte nicht zurückgezogen werden.')
                      }).finally(() => setBusy(false))
                    }}
                  >
                    Zurückziehen
                  </XpButton>
                </li>
              )
            })}
          </ul>
          <p className="mt-1 text-[10px] text-[#8bada7]">
            Die Platte bleibt bis zum Verkauf reserviert — zurückziehen gibt sie zurück ins Inventar.
          </p>
        </XpGroupBox>
      )}

      {/* Angebote durchsuchen */}
      <XpGroupBox title="Angebote" className="mt-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as Rarity | 'all')}
            className="glass-select !w-auto !py-1 !text-[11px]"
            aria-label="Nach Seltenheit filtern"
          >
            <option value="all">Alle Stufen</option>
            {RARITY_ORDER.map((r) => (
              <option key={r} value={r}>{RARITY_LABELS[r]}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche…"
            aria-label="Angebote durchsuchen"
            className="glass-input !w-28 !py-1 !text-[11px]"
          />
          <XpButton
            className="!px-2 !py-1 !text-[11px]"
            onClick={() => setSortByPrice((v) => (v === 'asc' ? 'desc' : 'asc'))}
          >
            Preis {sortByPrice === 'asc' ? '↑' : '↓'}
          </XpButton>
        </div>

        {marketApi.loading && <p className="text-[11px] text-[#8bada7]">Angebote werden geladen…</p>}
        {!marketApi.loading && filtered.length === 0 && (
          <p className="text-[12px] text-[#8bada7]">Keine Angebote gefunden.</p>
        )}
        <ul className="space-y-1">
          {filtered.map((listing) => {
            const plate = getPlate(listing.plateId)
            if (!plate) return null
            const affordable = listing.price <= coins
            return (
              <li key={listing.id} className="glass-inset flex items-center gap-2 p-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-[#eaf6f3]">{plate.name}</span>
                  <span className="block text-[10px] text-[#8bada7]">
                    von {listing.sellerName} · {formatWeight(plate.weightKg)}
                  </span>
                </span>
                <RarityBadge rarity={plate.rarity} />
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#ffcf7e]">
                  {listing.price.toLocaleString('de-DE')} 🪙
                </span>
                <XpButton
                  variant="primary"
                  className="!px-2 !py-1 !text-[11px]"
                  disabled={busy || !affordable}
                  onClick={() => void buy(listing)}
                >
                  {affordable ? 'Kaufen' : 'Zu teuer'}
                </XpButton>
              </li>
            )
          })}
        </ul>
      </XpGroupBox>

      {/* Transaktionshistorie */}
      <XpGroupBox title="Transaktionen" className="mt-2">
        {marketApi.transactions.length === 0 ? (
          <p className="text-[12px] text-[#8bada7]">Noch keine Käufe/Verkäufe.</p>
        ) : (
          <ul className="space-y-1 text-[11px] text-[#a9c4be]">
            {marketApi.transactions.slice(0, 10).map((tx: MarketTransaction) => (
              <li key={tx.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {tx.direction === 'buy' ? '⬇ Gekauft' : '⬆ Verkauft'}: {getPlate(tx.plateId)?.name ?? tx.plateId}
                </span>
                <span className={'shrink-0 tabular-nums font-bold ' + (tx.direction === 'buy' ? 'text-[#ff8a7a]' : 'text-[#5fd9a6]')}>
                  {tx.direction === 'buy' ? '−' : '+'}{tx.price.toLocaleString('de-DE')} 🪙
                </span>
              </li>
            ))}
          </ul>
        )}
      </XpGroupBox>
    </div>
  )
}
