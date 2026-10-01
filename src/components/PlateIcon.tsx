// Kleine Sammlungs-Bausteine: Platten-Icon (echtes PNG) mit
// Seltenheits-Glow und Seltenheits-Badge. Farben kommen aus RARITY_STYLES.

import { RARITY_LABELS, RARITY_STYLES, formatWeight, type Plate } from '../domain/plates'

/** Platten-Icon: PNG-Foto mit Glow-Schimmer je Seltenheit. */
export function PlateIcon({ plate, size = 40 }: { plate: Plate; size?: number }) {
  const style = RARITY_STYLES[plate.rarity]
  return (
    <span
      aria-hidden
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 45%, ${style.glow}, transparent 72%)`,
      }}
    >
      <img
        src={plate.image}
        alt=""
        draggable={false}
        style={{
          width: size * 0.92,
          height: size * 0.92,
          objectFit: 'contain',
          filter: `drop-shadow(0 0 ${Math.max(3, size / 10)}px ${style.glow})`,
        }}
      />
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
