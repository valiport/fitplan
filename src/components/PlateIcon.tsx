// Kleine Sammlungs-Bausteine: Platten-Icon mit Seltenheits-Rahmen
// und Seltenheits-Badge. Farben kommen aus RARITY_STYLES.

import { RARITY_LABELS, RARITY_STYLES, formatWeight, type Plate } from '../domain/plates'

/** Platten-Icon im Glas-Stil mit Glow je Seltenheit. */
export function PlateIcon({ plate, size = 40 }: { plate: Plate; size?: number }) {
  const style = RARITY_STYLES[plate.rarity]
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `radial-gradient(circle at 30% 25%, ${style.bg}, rgba(4,12,11,0.9))`,
        border: `1.5px solid ${style.border}`,
        boxShadow: `0 0 ${size / 3}px ${style.glow}, inset 0 1px 2px rgba(255,255,255,0.25)`,
      }}
    >
      {plate.icon}
    </span>
  )
}

/** Seltenheits-Label als kleiner farbiger Chip. */
export function RarityBadge({ rarity }: { rarity: Plate['rarity'] }) {
  const style = RARITY_STYLES[rarity]
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{ color: style.color, border: `1px solid ${style.border}`, background: style.bg }}
    >
      {RARITY_LABELS[rarity]}
    </span>
  )
}

/** Kompakte Platten-Karte (Icon + Name + Gewicht + optional Stückzahl). */
export function PlateChip({ plate, quantity, onClick }: {
  plate: Plate
  quantity?: number
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={
        'flex items-center gap-2 rounded-[14px] border px-2 py-1.5 text-left transition ' +
        (onClick ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default')
      }
      style={{ borderColor: RARITY_STYLES[plate.rarity].border, background: 'rgba(4,12,11,0.45)' }}
    >
      <PlateIcon plate={plate} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-[#eaf6f3]">{plate.name}</span>
        <span className="block text-[10px] text-[#8bada7]">{formatWeight(plate.weightKg)}</span>
      </span>
      {quantity !== undefined && quantity > 1 && (
        <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-[#d5e9e5]">
          ×{quantity}
        </span>
      )}
    </button>
  )
}
