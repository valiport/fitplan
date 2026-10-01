// Drop-Belohnung: Lightbox, die beim Abhaken einer Aufgabe die neue
// Platte zeigt (Glow je Seltenheit, Flavor-Text). Schließen per Klick
// oder Escape — dann ist der Drop im Inventar.

import { useEffect } from 'react'
import { RARITY_LABELS, RARITY_STYLES, formatWeight, type Plate } from '../domain/plates'
import { PlateIcon } from './PlateIcon'

export default function DropOverlay({ plate, onClose }: { plate: Plate | null; onClose: () => void }) {
  useEffect(() => {
    if (!plate) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plate, onClose])

  if (!plate) return null
  const style = RARITY_STYLES[plate.rarity]

  return (
    <div className="glass-lightbox-backdrop" onClick={onClose}>
      <div
        className="glass-panel glass-zoom-in w-full max-w-xs p-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#8bada7]">
          Belohnung erhalten
        </p>
        <div className="mt-3 flex justify-center">
          <span
            className="rounded-full p-1"
            style={{ boxShadow: `0 0 26px ${style.glow}, 0 0 60px ${style.glow}` }}
          >
            <PlateIcon plate={plate} size={64} />
          </span>
        </div>
        <p className="mt-3 text-[15px] font-bold" style={{ color: style.color }}>
          {plate.name}
        </p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#8bada7]">
          {RARITY_LABELS[plate.rarity]} · {formatWeight(plate.weightKg)}
        </p>
        <p className="mt-2 text-[12px] text-[#a9c4be]">{plate.description}</p>
        <button
          onClick={onClose}
          className="glass-btn glass-btn-primary mt-3 w-full !py-2 !text-[13px]"
        >
          In die Sammlung!
        </button>
      </div>
    </div>
  )
}
