// Sammlungs-Tab: Wallet, Inventar je Seltenheit, Sammelalbum-Fortschritt,
// Duplikate-Upgrades und der Balance-Check (Drops simulieren).

import { useMemo, useState } from 'react'
import {
  PLATES,
  RARITY_LABELS,
  RARITY_ORDER,
  RARITY_STYLES,
  MIN_PRICE,
  nextRarity,
} from '../domain/plates'
import { effectiveWeights, simulateDrops } from '../domain/drops'
import { PlateChip, RarityBadge } from './PlateIcon'
import { XpButton, XpGroupBox } from './ui'
import type { CollectionState } from '../hooks/useCollection'
import type { Rarity } from '../domain/plates'

const UPGRADE_COST = 3

export default function CollectionView({ userId, state, onUpgrade }: {
  userId: string
  state: CollectionState
  onUpgrade: (rarity: Rarity) => boolean
}) {
  const [sim, setSim] = useState<ReturnType<typeof simulateDrops> | null>(null)
  const [simStreak, setSimStreak] = useState(0)

  const inventory = state.inventory

  // Album: einmal je Platte gefunden?
  const album = useMemo(() => {
    const found = RARITY_ORDER.map((rarity) => {
      const pool = PLATES.filter((p) => p.rarity === rarity)
      const foundCount = pool.filter((p) => (inventory[p.id] ?? 0) > 0).length
      return { rarity, found: foundCount, total: pool.length }
    })
    return found
  }, [inventory])

  const totalPlates = useMemo(
    () => Object.values(inventory).reduce((a, b) => a + b, 0),
    [inventory],
  )

  // Upgrade-Verfügbarkeit je Stufe (>= 3 Duplikate über den Pool).
  const upgradable = useMemo(() => RARITY_ORDER.map((rarity) => {
    if (nextRarity(rarity) === null) return { rarity, count: 0, can: false }
    const pool = PLATES.filter((p) => p.rarity === rarity)
    const count = pool.reduce((sum, p) => sum + (inventory[p.id] ?? 0), 0)
    return { rarity, count, can: count >= UPGRADE_COST }
  }), [inventory])

  const runSim = (count: number) => {
    setSim(simulateDrops(count, simStreak))
  }

  return (
    <div className="text-left">
      {/* Wallet */}
      <div className="glass-inset mb-2 flex items-center justify-between px-2.5 py-2">
        <span className="text-[12px] font-bold text-[#ffcf7e]">🪙 Kontostand</span>
        <span className="text-[15px] font-bold tabular-nums text-[#ffcf7e]">
          {state.coins.toLocaleString('de-DE')} Coins
        </span>
      </div>

      {/* Sammelalbum-Fortschritt */}
      <XpGroupBox title="Sammelalbum">
        <ul className="text-[12px] text-[#dcefec]">
          {album.map(({ rarity, found, total }) => {
            const style = RARITY_STYLES[rarity]
            const percent = total === 0 ? 0 : Math.round((found / total) * 100)
            return (
              <li key={rarity} className="mb-1">
                <div className="flex items-center justify-between">
                  <span style={{ color: style.color }}>{RARITY_LABELS[rarity]}</span>
                  <span className="tabular-nums text-[#8bada7]">{found}/{total}</span>
                </div>
                <div className="glass-progress mt-0.5" style={{ height: 8 }}>
                  <div
                    className="glass-progress-fill"
                    style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${style.color}, ${style.glow})` }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-[#8bada7]">
                  Mindestpreis: {MIN_PRICE[rarity].toLocaleString('de-DE')} Coins
                </p>
              </li>
            )
          })}
        </ul>
        <p className="mt-1 text-[11px] text-[#9fb9b4]">
          Insgesamt {totalPlates} Platten im Inventar · Wert je Stufe siehe Mindestpreise
        </p>
      </XpGroupBox>

      {/* Upgrade-Box */}
      <XpGroupBox title="Duplikate-Upgrader" className="mt-2">
        <ul className="text-[12px] text-[#dcefec]">
          {upgradable.map(({ rarity, count, can }) => (
            <li key={rarity} className="mb-1 flex items-center justify-between gap-2">
              <span>
                {RARITY_LABELS[rarity]}: <span className="tabular-nums">{count}</span> Duplikate
              </span>
              <XpButton
                disabled={!can}
                onClick={() => onUpgrade(rarity)}
                className="!px-2 !py-1 !text-[11px]"
              >
                3 → 1 {nextRarity(rarity) ? RARITY_LABELS[nextRarity(rarity)!] : ''}
              </XpButton>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10px] text-[#8bada7]">
          3 Platten einer Stufe → 1 zufällige Platte der nächsten Stufe.
        </p>
      </XpGroupBox>

      {/* Inventar je Seltenheit */}
      <XpGroupBox title="Mein Inventar" className="mt-2">
        {totalPlates === 0 ? (
          <p className="text-[12px] text-[#8bada7]">
            Noch keine Platten — hake Training oder Mahlzeiten ab, um Drops zu bekommen!
          </p>
        ) : (
          RARITY_ORDER.map((rarity) => {
            const items = RARITY_ORDER
              .flatMap((r) => PLATES.filter((p) => p.rarity === r).map((p) => ({ plate: p, qty: inventory[p.id] ?? 0 })))
              .filter((entry) => entry.plate.rarity === rarity && entry.qty > 0)
            if (items.length === 0) return null
            return (
              <div key={rarity} className="mb-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <RarityBadge rarity={rarity} />
                  <span className="text-[10px] text-[#8bada7]">
                    {items.reduce((sum, e) => sum + e.qty, 0)} Stück
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {items.map(({ plate, qty }) => (
                    <PlateChip key={plate.id} plate={plate} quantity={qty} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </XpGroupBox>

      {/* Balance-Check (Simulation) */}
      <XpGroupBox title="Balance-Check (Simulation)" className="mt-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <label htmlFor="sim-streak" className="text-[11px] text-[#8bada7]">Streak-Bonus:</label>
          <select
            id="sim-streak"
            value={simStreak}
            onChange={(e) => setSimStreak(Number(e.target.value))}
            className="glass-select !w-auto !py-1 !text-[11px]"
          >
            {[0, 3, 5, 7, 10, 14].map((s) => (
              <option key={s} value={s}>Streak {s} ({Math.round(effectiveWeights(s).legendary * 10) / 10} % Legendary)</option>
            ))}
          </select>
          <XpButton className="!px-2 !py-1 !text-[11px]" onClick={() => runSim(1000)}>1.000 Drops</XpButton>
          <XpButton className="!px-2 !py-1 !text-[11px]" onClick={() => runSim(10000)}>10.000</XpButton>
        </div>
        {sim && (
          <ul className="text-[11px] text-[#dcefec]">
            {RARITY_ORDER.map((r) => (
              <li key={r} className="flex justify-between">
                <span style={{ color: RARITY_STYLES[r].color }}>{RARITY_LABELS[r]}</span>
                <span className="tabular-nums">
                  {sim.byRarity[r].percent.toFixed(2)} % ({sim.byRarity[r].count})
                </span>
              </li>
            ))}
            <li className="mt-1 text-[10px] text-[#8bada7]">
              Ø {sim.expectedDropsPerLegendary} Drops pro Legendary
            </li>
          </ul>
        )}
      </XpGroupBox>

      {/* Debug-Hinweis (userId ist im UI sonst nicht sichtbar) */}
      <p className="mt-2 text-[10px] text-[#5f7a75]">Sammlung von {userId.slice(0, 8)}…</p>
    </div>
  )
}
