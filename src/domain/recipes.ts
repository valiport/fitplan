// Rezept-Pool. Jedes Rezept definiert Zutaten pro Portion mit Basis-Mengen
// und Basis-Kalorien sowie eine Kochanleitung. Beim Tagesplan werden die
// Mengen linear auf das Kalorienziel der Mahlzeit skaliert (Faktor clamp
// 0.6–2.2) und auf 5 g gerundet — die Schritte gelten unverändert dazu.

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
  /** Kochanleitung als nummerierte Schritte. */
  steps: string[]
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
    steps: [
      'Haferflocken in eine Schüssel geben.',
      'Skyr verquirlen und mit den Haferflocken vermengen; bei dicker Konsistenz einen Schluck Milch unterrühren.',
      'Beeren (aufgetaut oder leicht erwärmt) darübergeben.',
      'Honig darüberträufeln und die Bowl ziehen lassen, bis die Flocken weich sind.',
    ],
  },
  {
    id: 'b-shake', slot: 'breakfast', name: 'Protein-Shake & Banane',
    diets: ['omnivore', 'vegetarian'], baseKcal: 430,
    items: [g('Proteinpulver', 40), ml('Milch', 300), pc('Banane', 1), g('Haferflocken', 40)],
    steps: [
      'Proteinpulver mit Milch im Shaker oder Mixer ansetzen.',
      'Banane schälen und zusammen mit den Haferflocken dazugeben; 30 s mixen bis cremig.',
      'In ein Glas füllen und kurz stehen lassen, bis die Flocken quellen.',
    ],
  },
  {
    id: 'b-vegan-porridge', slot: 'breakfast', name: 'Veganer Porridge mit Nüssen',
    diets: ['vegan'], baseKcal: 540,
    items: [g('Haferflocken', 80), ml('Sojamilch', 250), g('Walnüsse', 25), pc('Banane', 1)],
    steps: [
      'Haferflocken mit Sojamilch in einen Topf geben und kurz aufkochen.',
      'Bei mittlerer Hitze 5–8 min köcheln, dabei gelegentlich umrühren; bei Bedarf Milch nachgießen.',
      'In eine Schüssel füllen, Banane in Scheiben darauflegen.',
      'Walnüsse grob zerkleinern, darüberstreuen und servieren.',
    ],
  },
  {
    id: 'b-omelette', slot: 'breakfast', name: 'Omelette mit Vollkornbrot',
    diets: ['omnivore', 'vegetarian'], baseKcal: 500,
    items: [pc('Eier', 3), sl('Vollkornbrot', 2), g('Tomate', 80), g('Käse gerieben', 20)],
    steps: [
      'Eier verquirlen, salzen und pfeffern.',
      'Tomate würfeln.',
      'Pfanne bei mittlerer Hitze erhitzen (fettarm oder mit einem Teelöffel Öl), Eier eingießen.',
      'Wenn die Masse fast stockt, Tomatenwürfel und Käse auf eine Hälfte geben und das Omelette einmal falten.',
      'Vollkornbrot toasten und dazu servieren.',
    ],
  },
  {
    id: 'b-tofu-scramble', slot: 'breakfast', name: 'Tofu-Scramble auf Brot',
    diets: ['vegan'], baseKcal: 480,
    items: [g('Tofu', 200), sl('Vollkornbrot', 2), g('Paprika', 80), tb('Olivenöl', 1)],
    steps: [
      'Tofu mit einer Gabel grob zerdrücken.',
      'Paprika in feine Streifen schneiden.',
      'Olivenöl in der Pfanne erhitzen, Paprika 2 min anbraten.',
      'Tofu dazugeben und 4–5 min braten; mit Kurkuma, Salz und Pfeffer würzen.',
      'Vollkornbrot toasten, Scramble darauflegen.',
    ],
  },
  {
    id: 'b-quark-bowl', slot: 'breakfast', name: 'Quark-Bowl mit Apfel',
    diets: ['omnivore', 'vegetarian'], baseKcal: 420,
    items: [g('Magerquark', 250), pc('Apfel', 1), g('Haferflocken', 40), tb('Leinsamen', 1)],
    steps: [
      'Magerquark glatt rühren; nach Geschmack mit etwas Milch oder Wasser cremiger rühren.',
      'Haferflocken und geschrotete Leinsamen unterheben und 3–5 min quellen lassen.',
      'Apfel waschen, entkernen und in Stücke schneiden.',
      'Apfelstücke unter die Bowl mischen oder als Topping darauflegen.',
    ],
  },

  // ── Lunch ────────────────────────────────────────────────────────────────
  {
    id: 'l-chicken-rice', slot: 'lunch', name: 'Hähnchen mit Reis & Brokkoli',
    diets: ['omnivore'], baseKcal: 700,
    items: [g('Hähnchenbrust', 180), g('Reis (roh)', 90), g('Brokkoli', 200), tb('Olivenöl', 1)],
    steps: [
      'Reis nach Packungsanleitung kochen (Wasser-Verhältnis ca. 1:2).',
      'Brokkoli in Röschen teilen und 5–6 min in Salzwasser bissfest garen oder dämpfen.',
      'Hähnchenbrust in Streifen schneiden, würzen und bei mittlerer bis hoher Hitze je Seite 3–4 min braten, bis sie goldbraun und durchgegart ist.',
      'Olivenöl unter die Zutaten geben (z. B. über Reis und Brokkoli träufeln) und alles auf einem Teller anrichten.',
    ],
  },
  {
    id: 'l-lentil-dal', slot: 'lunch', name: 'Linsen-Dal mit Reis',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 650,
    items: [g('Rote Linsen', 120), g('Reis (roh)', 80), g('Tomaten passiert', 200), g('Spinat', 100)],
    steps: [
      'Rote Linsen in einem Sieb gründlich waschen.',
      'Reis nach Packungsanleitung kochen.',
      'Linsen mit passierten Tomaten und ca. 400 ml Wasser in einen Topf geben; 15–20 min sanft köcheln, bis die Linsen zerfallen.',
      'Mit Salz, Kurkuma, Kreuzkümmel und Chili abschmecken.',
      'Spinat in den Topf geben, 2 min mitziehen lassen.',
      'Dal über dem Reis servieren.',
    ],
  },
  {
    id: 'l-pasta-veg', slot: 'lunch', name: 'Nudeln mit Tomatensauce & Parmesan',
    diets: ['vegetarian'], baseKcal: 680,
    items: [g('Nudeln (roh)', 110), g('Tomaten passiert', 200), g('Parmesan', 20), tb('Olivenöl', 1)],
    steps: [
      'Nudeln in reichlich Salzwasser al dente kochen.',
      'Passierte Tomaten in einem kleinen Topf 10 min sanft köcheln; mit Salz, Pfeffer und etwas Oregano abschmecken.',
      'Olivenöl am Ende unter die Sauce rühren — sie wird samtig.',
      'Nudeln abgießen, mit der Sauce vermengen und Parmesan darüberreiben.',
    ],
  },
  {
    id: 'l-tofu-stirfry', slot: 'lunch', name: 'Tofu-Wok mit Reisnudeln',
    diets: ['vegan'], baseKcal: 660,
    items: [g('Tofu', 200), g('Reisnudeln', 90), g('Gemüse-Mix TK', 250), g('Sojasauce', 20)],
    steps: [
      'Reisnudeln nach Packungsanleitung in heißem Wasser einweichen, abgießen.',
      'Tofu in Würfel schneiden und in einer heißen Pfanne/Wok mit etwas Öl rundum 5–6 min knusprig braten, dann herausnehmen.',
      'TK-Gemüse im Wok 4–5 min scharf anbraten.',
      'Tofu, Reisnudeln und Sojasauce zurück in den Wok geben und 1–2 min schwenken.',
    ],
  },
  {
    id: 'l-salmon-potato', slot: 'lunch', name: 'Lachs mit Kartoffeln & Salat',
    diets: ['omnivore'], baseKcal: 690,
    items: [g('Lachsfilet', 150), g('Kartoffeln', 300), g('Blattsalat', 80), tb('Olivenöl', 1)],
    steps: [
      'Kartoffeln waschen und 20–25 min in Salzwasser garen.',
      'Blattsalat waschen, schleudern und mit Olivenöl, Salz und Essig oder Zitrone anmachen.',
      'Lachsfilet abtupfen, würzen und auf der Hautseite 3–4 min scharf anbraten; wenden und 2–3 min fertig garen.',
      'Kartoffeln abgießen, alles zusammen anrichten.',
    ],
  },
  {
    id: 'l-chickpea-bowl', slot: 'lunch', name: 'Kichererbsen-Bowl mit Feta',
    diets: ['vegetarian'], baseKcal: 640,
    items: [g('Kichererbsen (Dose, abgetropft)', 200), g('Couscous (roh)', 70), g('Feta', 40), g('Gurke', 100)],
    steps: [
      'Couscous mit der gleichen Menge kochendem Wasser übergießen und 5–8 min quellen lassen; mit einer Gabel auflockern.',
      'Kichererbsen abgießen und abspülen; nach Geschmack in einer Pfanne kurz anrösten oder kalt verwenden.',
      'Gurke würfeln, Feta zerbröseln.',
      'Alles in einer Schüssel anrichten; mit Olivenöl, Zitrone, Salz und Pfeffer abschmecken.',
    ],
  },

  // ── Snack ────────────────────────────────────────────────────────────────
  {
    id: 's-skyr', slot: 'snack', name: 'Skyr mit Honig',
    diets: ['omnivore', 'vegetarian'], baseKcal: 260,
    items: [g('Skyr', 250), tb('Honig', 1), g('Beeren (TK)', 80)],
    steps: [
      'Skyr in eine Schüssel geben.',
      'Beeren 5–10 min auftauen lassen (oder kurz in der Mikrowelle antauen) und dazugeben.',
      'Honig darüberträufeln, umrühren und genießen.',
    ],
  },
  {
    id: 's-nuts', slot: 'snack', name: 'Nüsse & Obst',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 300,
    items: [g('Mandeln', 30), pc('Apfel', 1)],
    steps: [
      'Apfel waschen — in Viertel oder Spalten schneiden, Kerngehäuse entfernen.',
      'Mandeln dazu reichen; zusammen essen für die Kombi aus schnellen Kohlen und gesunden Fetten.',
      'Unterwegs: beides in eine Dose packen, fertig ist der Snack.',
    ],
  },
  {
    id: 's-shake', slot: 'snack', name: 'Protein-Shake',
    diets: ['omnivore', 'vegetarian'], baseKcal: 280,
    items: [g('Proteinpulver', 40), ml('Milch', 250)],
    steps: [
      'Milch in den Shaker füllen.',
      'Proteinpulver dazugeben und 20–30 s kräftig schütteln, bis keine Klümpchen mehr übrig sind.',
      'Direkt trinken oder gekühlt lagern (max. ein Tag).',
    ],
  },
  {
    id: 's-hummus', slot: 'snack', name: 'Hummus mit Gemüsesticks',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 250,
    items: [g('Hummus', 100), g('Karotte', 120), g('Gurke', 100)],
    steps: [
      'Karotte und Gurke waschen, schälen (Karotte) und in Stifte schneiden.',
      'Hummus in eine kleine Schale füllen.',
      'Gemüsesticks in den Hummus dippen und genießen.',
    ],
  },
  {
    id: 's-sojajoghurt', slot: 'snack', name: 'Sojajoghurt mit Müsli',
    diets: ['vegan'], baseKcal: 290,
    items: [g('Sojajoghurt', 250), g('Müsli', 40)],
    steps: [
      'Sojajoghurt in eine Schüssel geben.',
      'Müsli daraufstreuen.',
      'Kurz stehen lassen, bis das Müsli leicht quillt — oder direkt genießen für mehr Biss.',
    ],
  },
  {
    id: 's-banana-bread', slot: 'snack', name: 'Vollkornbrot mit Erdnussbutter',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 310,
    items: [sl('Vollkornbrot', 2), g('Erdnussbutter', 30), pc('Banane', 1)],
    steps: [
      'Vollkornbrot nach Geschmack toasten oder so essen.',
      'Erdnussbutter glatt rühren und dünn auf beide Scheiben streichen.',
      'Banane in Scheiben schneiden und auf einer Scheibe verteilen; zweite Scheibe darauflegen wie ein Sandwich oder separat essen.',
    ],
  },

  // ── Abend ────────────────────────────────────────────────────────────────
  {
    id: 'd-turkey-veg', slot: 'dinner', name: 'Pute mit Ofengemüse & Quinoa',
    diets: ['omnivore'], baseKcal: 620,
    items: [g('Putengeschnetzeltes', 160), g('Quinoa (roh)', 70), g('Ofengemüse', 250), tb('Olivenöl', 1)],
    steps: [
      'Quinoa in einem Sieb waschen, dann mit der doppelten Wassermenge 12–15 min sanft köcheln; abgedeckt quellen lassen.',
      'Ofen auf 200 °C (Ober-/Unterhitze) vorheizen. Ofengemüse mit Olivenöl, Salz und Kräutern mischen und 25–30 min backen.',
      'Putengeschnetzeltes in der Pfanne 4–6 min scharf braten, würzen und ruhen lassen.',
      'Alles anrichten, restliches Olivenöl über das Gericht träufeln.',
    ],
  },
  {
    id: 'd-dal-soup', slot: 'dinner', name: 'Linsensuppe mit Brot',
    diets: ['omnivore', 'vegetarian', 'vegan'], baseKcal: 560,
    items: [g('Rote Linsen', 100), g('Gemüsebrühe', 400), sl('Vollkornbrot', 2), g('Karotte', 100)],
    steps: [
      'Rote Linsen waschen; Karotte klein würfeln.',
      'Linsen mit Gemüsebrühe und Karotte in einen Topf geben und 15–20 min sanft köcheln, bis alles weich ist.',
      'Mit Salz, Pfeffer, Kreuzkümmel und etwas Zitrone abschmecken; für mehr Cremigkeit kurz pürieren (optional).',
      'Vollkornbrot dazu servieren.',
    ],
  },
  {
    id: 'd-egg-frittata', slot: 'dinner', name: 'Frittata mit Spinat & Kartoffeln',
    diets: ['vegetarian'], baseKcal: 600,
    items: [pc('Eier', 3), g('Kartoffeln', 250), g('Spinat', 150), g('Käse gerieben', 30)],
    steps: [
      'Kartoffeln in dünne Scheiben schneiden und 12–15 min in Salzwasser vorkochen.',
      'Ofen auf 200 °C vorheizen; Eier mit Salz und Pfeffer verquirlen.',
      'Hitzebeständige Pfanne mit etwas Öl erhitzen; Kartoffeln, Spinat und Eier dazugeben und 3–4 min von unten stocken lassen.',
      'Käse darüberstreuen und die Frittata 8–10 min im Ofen fertig garen, bis sie goldgelb ist.',
      'In Stücken servieren — warm oder kalt.',
    ],
  },
  {
    id: 'd-tofu-curry', slot: 'dinner', name: 'Tofu-Curry mit Reis',
    diets: ['vegan'], baseKcal: 610,
    items: [g('Tofu', 180), ml('Kokosmilch', 150), g('Reis (roh)', 70), g('Brokkoli', 200)],
    steps: [
      'Reis nach Packungsanleitung kochen.',
      'Tofu würfeln und in einer heißen Pfanne mit etwas Öl 5–6 min knusprig braten, beiseitestellen.',
      'Brokkoli in Röschen teilen und 4–5 min in der Pfanne anbraten.',
      'Kokosmilch mit Currypaste oder -pulver einrühren, Tofu und Brokkoli zugeben und 5 min köcheln lassen.',
      'Mit Reis servieren.',
    ],
  },
  {
    id: 'd-fish-veg', slot: 'dinner', name: 'Kabeljau mit Gemüse & Kartoffeln',
    diets: ['omnivore'], baseKcal: 580,
    items: [g('Kabeljaufilet', 180), g('Kartoffeln', 250), g('Gemüse-Mix TK', 250), tb('Olivenöl', 1)],
    steps: [
      'Kartoffeln 20–25 min in Salzwasser garen.',
      'TK-Gemüse nach Packungsanleitung in der Pfanne oder im Dämpfer garen (ca. 6–8 min), mit Olivenöl und Salz abschmecken.',
      'Kabeljau abtupfen, würzen; in einer Pfanne mit etwas Öl je Seite 3–4 min sanft braten — Fisch zerfällt leicht, also vorsichtig wenden.',
      'Alles anrichten, Zitrone über den Fisch spritzen.',
    ],
  },
  {
    id: 'd-cottage-bowl', slot: 'dinner', name: 'Quark-Hüttenkäse-Bowl',
    diets: ['vegetarian'], baseKcal: 520,
    items: [g('Hüttenkäse', 250), g('Kirschtomaten', 150), sl('Vollkornbrot', 2), tb('Olivenöl', 1)],
    steps: [
      'Kirschtomaten waschen und halbieren.',
      'Hüttenkäse in eine Schüssel geben; mit Salz, Pfeffer und gehackten Kräutern (z. B. Schnittlauch) abschmecken.',
      'Tomaten unterheben, Olivenöl darüberträufeln.',
      'Vollkornbrot dazu reichen — zum Dippen oder daneben.',
    ],
  },
]
