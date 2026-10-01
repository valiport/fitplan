// Sammlung: Gewichtsplatten als Sammelgegenstände.
// Katalog + Seltenheitssystem. Alle Texte deutsch, IDs sind stabil
// (in der DB referenziert) — niemals ändern oder wiederverwenden.

/** Seltenheitsstufen mit Drop-Gewichtung (Basiswahrscheinlichkeiten). */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

/** Basis-Dropgewichte je Stufe (summiert sich zu 100 %). */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
}

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Gewöhnlich',
  uncommon: 'Selten',
  rare: 'Rar',
  epic: 'Episch',
  legendary: 'Legendär',
}

/** Farben/Glühen je Stufe — konsistent in Icon, Album und Drop-Overlay. */
export const RARITY_STYLES: Record<Rarity, { color: string; glow: string; border: string; bg: string }> = {
  common: { color: '#a8b3ae', glow: 'rgba(168,179,174,0.35)', border: 'rgba(168,179,174,0.55)', bg: 'rgba(90,100,96,0.35)' },
  uncommon: { color: '#5fe3d4', glow: 'rgba(95,227,212,0.45)', border: 'rgba(95,227,212,0.6)', bg: 'rgba(20,80,72,0.4)' },
  rare: { color: '#7ea2ff', glow: 'rgba(126,162,255,0.5)', border: 'rgba(126,162,255,0.65)', bg: 'rgba(38,58,120,0.45)' },
  epic: { color: '#c98fff', glow: 'rgba(201,143,255,0.55)', border: 'rgba(201,143,255,0.7)', bg: 'rgba(80,40,120,0.45)' },
  legendary: { color: '#ffd98a', glow: 'rgba(255,217,138,0.6)', border: 'rgba(255,217,138,0.75)', bg: 'rgba(120,84,16,0.45)' },
}

/** Mindestpreis je Stufe in Coins (Richtwert beim Verkaufen). */
export const MIN_PRICE: Record<Rarity, number> = {
  common: 15,
  uncommon: 60,
  rare: 250,
  epic: 900,
  legendary: 4000,
}

/** Coins für eine erledigte Aufgabe (zusätzlich zum Drop). */
export const COINS_PER_CHECK = 5

/** Ein sammelbarer Platten-Typ. */
export interface Plate {
  id: string
  name: string
  weightKg: number
  rarity: Rarity
  /** PNG unter public/plates/ (echtes Plattenfoto, transparenter BG). */
  image: string
  description: string
}

export const PLATES: Plate[] = [
  // Common — schwarze Gussplatten
  { id: 'cp-125', name: 'Gussplatte 1,25 kg', weightKg: 1.25, rarity: 'common', image: '/plates/cp-125.png', description: 'Der zuverlässige Einstieg — klein, schwarz, immer in der Tasche.' },
  { id: 'cp-25', name: 'Gussplatte 2,5 kg', weightKg: 2.5, rarity: 'common', image: '/plates/cp-25.png', description: 'Solides Gusseisen. Nicht glamourös, aber immer dienstbereit.' },
  // Uncommon — Gummiplatten in Standardfarben
  { id: 'gp-5', name: 'Gummiplatte 5 kg (Grün)', weightKg: 5, rarity: 'uncommon', image: '/plates/gp-5.png', description: 'Bodenfreundlich und leise. Der Star jedes Heim-Studios.' },
  { id: 'gp-10', name: 'Gummiplatte 10 kg (Gelb)', weightKg: 10, rarity: 'uncommon', image: '/plates/gp-10.png', description: 'Griffig durch den Ausschnitt — der Allrounder für jeden Tag.' },
  // Rare — Bumper in Signalfarben
  { id: 'bp-15', name: 'Bumper 15 kg (Signalblau)', weightKg: 15, rarity: 'rare', image: '/plates/bp-15.png', description: 'Turnhallen-Klassiker. Wird beim Fallen denkbar laut — egal.' },
  { id: 'bp-20', name: 'Bumper 20 kg (Signalrot)', weightKg: 20, rarity: 'rare', image: '/plates/bp-20.png', description: 'Signalfarben und wettkampftauglich. Jeder will ihn sehen.' },
  // Epic — Spezial-Designs
  { id: 'carbon-25', name: 'Carbon 25 kg', weightKg: 25, rarity: 'epic', image: '/plates/carbon-25.png', description: 'Carbon-Look, Innenleben Geheimnis. Schwerer als das Gesetz erlaubt.' },
  { id: 'glow-25', name: 'Chrom 10 kg', weightKg: 10, rarity: 'epic', image: '/plates/chrom-10.png', description: 'Vollmetall in Grau mit Spiegelfinish. Blitzt in jeder Regalreihe.' },
  // Legendary — farbige Sondereditionen
  { id: 'gold-50', name: 'Amethyst 5 kg', weightKg: 5, rarity: 'legendary', image: '/plates/amethyst-5.png', description: 'Edelstein-Edition in Violett. Leicht im Gewicht, unbezahlbar im Wert.' },
  { id: 'edition-50', name: 'Glut 2,5 kg', weightKg: 2.5, rarity: 'legendary', image: '/plates/glut-2-5.png', description: 'Glühendes Orange — als käme sie frisch aus der Schmiede. Kult.' },
]

const PLATE_BY_ID = new Map(PLATES.map((p) => [p.id, p]))

/** Katalog-Zugriff; unbekannte IDs kommen z. B. aus kaputten Cloud-Zeilen. */
export function getPlate(id: string): Plate | null {
  return PLATE_BY_ID.get(id) ?? null
}

/** Alle Platten einer Stufe (für Drops und Upgrades). */
export function platesOfRarity(rarity: Rarity): Plate[] {
  return PLATES.filter((p) => p.rarity === rarity)
}

/** Nächsthöhere Stufe (null bei legendary). */
export function nextRarity(rarity: Rarity): Rarity | null {
  const index = RARITY_ORDER.indexOf(rarity)
  return index >= 0 && index < RARITY_ORDER.length - 1 ? RARITY_ORDER[index + 1] : null
}

/** Inventar-Map: plateId → Stückzahl (nur > 0). */
export type Inventory = Record<string, number>

/** Deutsche Kurzform für Gewichte (1,25 kg). */
export function formatWeight(kg: number): string {
  return `${kg.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg`
}
