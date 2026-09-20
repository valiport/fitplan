// Rezept-Pool. Jedes Rezept definiert Zutaten pro Portion mit Basis-Mengen
// und Basis-Kalorien. Beim Tagesplan werden die Mengen linear auf das
// Kalorienziel der Mahlzeit skaliert (Faktor clamp 0.6–2.2) und auf 5 g gerundet.

import type { Diet, Ingredient, MealSlot } from './types'

export interface Recipe {
  id: string
  slot: MealSlot
  name: string
  /** Für welche Ernährungsformen das Rezept passt. */
  diets: Diet[]
  /** Kalorien der Basis-Portion. */
  baseKcal: number
  items: Ingredient[]
}

const g = (name: string, grams: number): Ingredient => ({ name, grams, unit: 'g' })
const ml = (name: string, grams: number): Ingredient => ({ name, grams, unit: 'ml' })
const pc = (name: string, grams: number): Ingredient => ({ name, grams, unit: 'Stück' })
const tb = (name: string, grams: number): Ingredient => ({ name, grams, unit: 'EL' })
const sl = (name: string, grams: number): Ingredient => ({ name, grams, unit: 'Scheiben' })

export const RECIPES: Recipe[] = [
  // ── Frühstück ────────────────────────────────────────────────────────────
  {
    id: 'b-oats', slot: 'breakfast', name: 'Haferflocken mit Skyr & Beeren',
    diets: ['omnivore', 'vegetarian'], baseKcal: 520,
    items: [g('Haferflocken', 80), g('Skyr', 200), g('Beeren (TK)', 100), tb('Honig', 1)],
  },
  {
    id: 'b-shake', slot: 'breakfast', name: 'Protein-Shake & Banane',
    diets: ['omnivore', 'vegetarian'], baseKcal: 430,
    items: [g('Proteinpulver', 40), ml('Milch', 300), pc('Banane', 1), g('Haferflocken', 40)],
  },
  {
    id: 'b-vegan-porridge', slot: 'breakfast', name: 'Veganer Porridge mit Nüssen',
    diets: ['vegan'], baseKcal: 540,
    items: [g('Haferflocken', 80), ml('Sojamilch', 250), g('Walnüsse', 25), pc('Banane', 1)],
  },
  {
    id: 'b-omelette', slot: 'breakfast', name: 'Omelette mit Vollkornbrot',
    diets: ['omnivore', 'vegetarian'], baseKcal: 500,
    items: [pc('Eier', 3), sl('Vollkornbrot', 2), g('Tomate', 80), g('Käse gerieben', 20)],
  },
  {
    id: 'b-tofu-scramble', slot: 'breakfast', name: 'Tofu-Scramble auf Brot',
    diets: ['vegan'], baseKcal: 480,
    items: [g('Tofu', 200), sl('Vollkornbrot', 2), g('Paprika', 80), tb('Olivenöl', 1)],
  },
  {
    id: 'b-quark-bowl', slot: 'breakfast', name: 'Quark-Bowl mit Apfel',
    diets: ['omnivore', 'vegetarian'], baseKcal: 420,
    items: [g('Magerquark', 250), pc('Apfel', 1), g('Haferflocken', 40), tb('Leinsamen', 1)],
  },

  // ── Lunch ────────────────────────────────────────────────────────────────
  {
    id: 'l-chicken-rice', slot: 'lunch', name: 'Hähnchen mit Reis & Brokkoli',
    diets: ['omnivore'], baseKcal: 700,
    items: [g('Hähnchenbrust', 180), g('Reis (roh)', 90), g('Brokkoli', 200), tb('Olivenöl', 1)],
  },
  {
    id: 'l-lentil-dal', slot: 'lunch', name: 'Linsen-Dal mit Reis',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 650,
    items: [g('Rote Linsen', 120), g('Reis (roh)', 80), g('Tomaten passiert', 200), g('Spinat', 100)],
  },
  {
    id: 'l-pasta-veg', slot: 'lunch', name: 'Nudeln mit Tomatensauce & Parmesan',
    diets: ['vegetarian'], baseKcal: 680,
    items: [g('Nudeln (roh)', 110), g('Tomaten passiert', 200), g('Parmesan', 20), tb('Olivenöl', 1)],
  },
  {
    id: 'l-tofu-stirfry', slot: 'lunch', name: 'Tofu-Wok mit Reisnudeln',
    diets: ['vegan'], baseKcal: 660,
    items: [g('Tofu', 200), g('Reisnudeln', 90), g('Gemüse-Mix TK', 250), g('Sojasauce', 20)],
  },
  {
    id: 'l-salmon-potato', slot: 'lunch', name: 'Lachs mit Kartoffeln & Salat',
    diets: ['omnivore'], baseKcal: 690,
    items: [g('Lachsfilet', 150), g('Kartoffeln', 300), g('Blattsalat', 80), tb('Olivenöl', 1)],
  },
  {
    id: 'l-chickpea-bowl', slot: 'lunch', name: 'Kichererbsen-Bowl mit Feta',
    diets: ['vegetarian'], baseKcal: 640,
    items: [g('Kichererbsen (Dose, abgetropft)', 200), g('Couscous (roh)', 70), g('Feta', 40), g('Gurke', 100)],
  },

  // ── Snack ────────────────────────────────────────────────────────────────
  {
    id: 's-skyr', slot: 'snack', name: 'Skyr mit Honig',
    diets: ['omnivore', 'vegetarian'], baseKcal: 260,
    items: [g('Skyr', 250), tb('Honig', 1), g('Beeren (TK)', 80)],
  },
  {
    id: 's-nuts', slot: 'snack', name: 'Nüsse & Obst',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 300,
    items: [g('Mandeln', 30), pc('Apfel', 1)],
  },
  {
    id: 's-shake', slot: 'snack', name: 'Protein-Shake',
    diets: ['omnivore', 'vegetarian'], baseKcal: 280,
    items: [g('Proteinpulver', 40), ml('Milch', 250)],
  },
  {
    id: 's-hummus', slot: 'snack', name: 'Hummus mit Gemüsesticks',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 250,
    items: [g('Hummus', 100), g('Karotte', 120), g('Gurke', 100)],
  },
  {
    id: 's-sojajoghurt', slot: 'snack', name: 'Sojajoghurt mit Müsli',
    diets: ['vegan'], baseKcal: 290,
    items: [g('Sojajoghurt', 250), g('Müsli', 40)],
  },
  {
    id: 's-banana-bread', slot: 'snack', name: 'Vollkornbrot mit Erdnussbutter',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 310,
    items: [sl('Vollkornbrot', 2), g('Erdnussbutter', 30), pc('Banane', 1)],
  },

  // ── Abend ────────────────────────────────────────────────────────────────
  {
    id: 'd-turkey-veg', slot: 'dinner', name: 'Pute mit Ofengemüse & Quinoa',
    diets: ['omnivore'], baseKcal: 620,
    items: [g('Putengeschnetzeltes', 160), g('Quinoa (roh)', 70), g('Ofengemüse', 250), tb('Olivenöl', 1)],
  },
  {
    id: 'd-dal-soup', slot: 'dinner', name: 'Linsensuppe mit Brot',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 560,
    items: [g('Rote Linsen', 100), g('Gemüsebrühe', 400), sl('Vollkornbrot', 2), g('Karotte', 100)],
  },
  {
    id: 'd-egg-frittata', slot: 'dinner', name: 'Frittata mit Spinat & Kartoffeln',
    diets: ['vegetarian'], baseKcal: 600,
    items: [pc('Eier', 3), g('Kartoffeln', 250), g('Spinat', 150), g('Käse gerieben', 30)],
  },
  {
    id: 'd-tofu-curry', slot: 'dinner', name: 'Tofu-Curry mit Reis',
    diets: ['vegan'], baseKcal: 610,
    items: [g('Tofu', 180), ml('Kokosmilch', 150), g('Reis (roh)', 70), g('Brokkoli', 200)],
  },
  {
    id: 'd-fish-veg', slot: 'dinner', name: 'Kabeljau mit Gemüse & Kartoffeln',
    diets: ['omnivore'], baseKcal: 580,
    items: [g('Kabeljaufilet', 180), g('Kartoffeln', 250), g('Gemüse-Mix TK', 250), tb('Olivenöl', 1)],
  },
  {
    id: 'd-cottage-bowl', slot: 'dinner', name: 'Quark-Hüttenkäse-Bowl',
    diets: ['vegetarian'], baseKcal: 520,
    items: [g('Hüttenkäse', 250), g('Kirschtomaten', 150), sl('Vollkornbrot', 2), tb('Olivenöl', 1)],
  },
]
