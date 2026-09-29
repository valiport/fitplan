// Wochenstruktur & Übungs-Bibliothek.
// Pro Sportart: Pools für harte Tage, leichte Tage und Ruhetage sowie
// Ergänzungsübungen. Jeder Einheit ist ein detaillierter Guide zugeordnet
// (Ausführung, Dauer, Intensität, Tipps, benötigte Ausrüstung).
// Die Wochenrotation wählt pro Woche unterschiedliche Einheiten, damit man
// nicht zweimal pro Woche dieselbe Übung macht.

import type { DayKind, Equipment, Sport, WorkoutGuide, WorkoutKey } from './types'

/**
 * Verteilt `trainingDays` (1–6) Trainingstage auf die Woche (Mo..So).
 * Schema: hart/leicht im Wechsel, Ruhetage dazwischen; Rest-Tage hinten Ruhe.
 */
export function buildWeekKinds(trainingDays: number): DayKind[] {
  const days: DayKind[] = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest']
  const slots = [0, 2, 4, 1, 3, 5] // Reihenfolge der belegten Tage
  for (let i = 0; i < Math.min(Math.max(trainingDays, 0), 6); i++) {
    days[slots[i]] = i % 2 === 0 ? 'hard' : 'easy'
  }
  return days
}

interface WorkoutLibrary {
  hard: { key: WorkoutKey; label: string }[]
  easy: { key: WorkoutKey; label: string }[]
  rest: { key: WorkoutKey; label: string }[]
  supplements: string[]
}

/** Ausführliche Anleitung je Einheit (Zusammenfassung, Ausführung, Dauer, Intensität, Tipps, Ausrüstung). */
export const WORKOUT_GUIDES: Record<WorkoutKey, WorkoutGuide> = {
  'rest-day-mobility': {
    summary: 'Aktive Erholung: lockere Bewegung, Mobility und Dehnen — der Körper soll sich regenerieren.',
    howTo: [
      '30–40 min spazieren gehen oder locker radeln — ganz ohne Pulsziel, reines „in Bewegung bleiben“.',
      '10–15 min Mobility: Hüftkreisen, Knöchel mobilisieren, Schulterkreisen, Katze-Kuh.',
      '5–10 min Dehnen der diese Woche belasteten Muskelgruppen; jede Position 20–30 s halten, ruhig weiteratmen.',
      'Früh fertig sein: Dieser Tag dient der Regeneration, nicht dem Trainingseifer.',
    ],
    duration: 'ca. 30–45 min, komplett locker',
    intensity: 'Sehr niedrig (unter 60 % HFmax)',
    tips: [
      'Schlaf und Protein sind an diesem Tag wichtiger als jede Einheit.',
      'Schwere Beine? Leichte Bewegung (Spaziergang) hilft mehr als Sitzen.',
      'Bei echten Schmerzen (nicht Muskelkater) kürzen und beobachten.',
    ],
    equipment: ['none'],
  },
  'running-hard-intervals-800': {
    summary: 'Sechs 800-m-Intervalle für VO₂max, Tempohärte und Laufökonomie.',
    howTo: [
      '15 min ganz locker einlaufen, danach 3 × 20 s Steigerungsläufe.',
      '800 m zügig laufen — etwa die Geschwindigkeit, die du 45–60 min im Wettkampf halten könntest.',
      'Danach 400 m traben (ca. 2–2,5 min), locker, nicht stehen bleiben.',
      'Wiederhole das 6-mal. Wenn du ab dem 4. Interval deutlich einbrechst, lieber ein Intervall weniger.',
      '10 min auslaufen und kurz dehnen.',
    ],
    duration: 'ca. 60–70 min inkl. Ein- und Auslaufen',
    intensity: 'Intervalle bei ca. 90–95 % HFmax, Trab dazwischen ca. 60–70 %',
    tips: [
      'Gleichmäßige Zeiten sind wichtiger als ein starkes erstes Intervall.',
      'Auf der Bahn oder einem gemessenen, flachen Weg laufen.',
      'An heißen Tagen: Pausen verlängern statt Tempo überziehen.',
    ],
    equipment: ['track'],
  },
  'running-hard-tempo': {
    summary: '20–40 min durchgehender Tempodauerlauf an der Laktatschwelle.',
    howTo: [
      '15 min ruhig einlaufen.',
      '20–40 min am Stück zügig, aber kontrolliert laufen — du solltest noch kurze Sätze sprechen können.',
      'Zum Schluss 10 min locker auslaufen.',
      'Bei der ersten Tempoeinheit eher 20 min wählen und von Woche zu Woche steigern.',
    ],
    duration: 'ca. 45–65 min gesamt',
    intensity: '„Komfortabel hart“: ca. 85–90 % HFmax',
    tips: [
      'Nicht zu schnell beginnen — der Tempoblock soll gleichmäßig durchgehalten werden.',
      'Flache, übersichtliche Strecke ohne viele Ampeln.',
      'Als Faustregel: Tempo, das du etwa 60 min am Stück halten könntest.',
    ],
    equipment: ['none'],
  },
  'running-hard-intervals-400': {
    summary: 'Acht 400-m-Intervalle für Schnelligkeit und VO₂max.',
    howTo: [
      '15 min einlaufen, 3 × 20 s Steigerungen.',
      '400 m schnell, aber ohne komplett auszupowern — spürbar schneller als Tempo-Tempo.',
      'Nach jedem Intervall 90 s bis 2 min locker traben.',
      '8 Wiederholungen; bei Technikfehlern am Ende lieber abbrechen.',
      '10 min auslaufen.',
    ],
    duration: 'ca. 50–60 min inkl. Ein- und Auslaufen',
    intensity: 'Intervalle ca. 90–95 % HFmax, Pausentrab ca. 60 %',
    tips: [
      'Auf gute Laufschule achten: aufrechte Haltung, kurze Bodenkontaktzeit.',
      'Pausen konsistent halten — sie steuern die Härte der Einheit.',
      'Nicht direkt vor einem langen Lauf am nächsten Tag einplanen.',
    ],
    equipment: ['track'],
  },
  'running-easy-long': {
    summary: 'Langer Lauf in ruhigem Tempo für Grundlagenausdauer und Fettstoffwechsel.',
    howTo: [
      'In völlig ruhigem Tempo starten — du solltest dich mitsprechen können.',
      '60–120 min am Stück laufen, je nach aktuellem Leistungsstand.',
      'Unterwegs trinken; bei über 75 min gerne einen kleinen Snack einplanen.',
      'Tempo konstant halten — keine Steigerungen, kein „Finisher-Sprint“.',
    ],
    duration: '60–120 min',
    intensity: 'ca. 60–70 % HFmax, durchgehend unterhältbar',
    tips: [
      'Nasenne: Wenn das Tempo am Ende steigt, war die Einheit zu schnell.',
      'Ideal am Wochenende, nicht direkt an einen harten Tag gekoppelt.',
      'Route vorher planen, Wasser einpacken oder Trinkmöglichkeiten festlegen.',
    ],
    equipment: ['none'],
  },
  'running-easy-steady': {
    summary: 'Ruhiger 40–50-min-Dauerlauf mit Steigerungsläufen zum Abschluss.',
    howTo: [
      '40–50 min locker durchlaufen, Gesprächstempo.',
      'Am Ende 4 × 20 s Steigerungsläufe: locker beschleunigen, nicht sprinten.',
      'Zwischen den Steigerungen jeweils 40–60 s locker traben.',
      'Kurz dehnen und Schuhe ausluften.',
    ],
    duration: '45–55 min',
    intensity: 'ca. 60–70 % HFmax',
    tips: [
      'Diese Einheit soll gut tun — lieber 5 min kürzer als zäh.',
      'Steigerungsläufe lösen Hüfte und Waden für schnellere Einheiten.',
      'Auch bei Müdigkeit eine gute Option, ohne den Plan zu brechen.',
    ],
    equipment: ['none'],
  },
  'running-easy-abc': {
    summary: 'Lauf-ABC mit Kniehebelauf, Anfersen und Skippings für Technik und Koordination.',
    howTo: [
      '10 min locker einlaufen.',
      'Lauf-ABC im Wechsel: je 20–30 m Kniehebelauf, Anfersen, Seit hops, Skippings.',
      'Nach jeder Übung 20–30 m locker auslaufen und kurz verschnaufen.',
      '3–4 Runden durch alle Übungen, Qualität vor Tempo.',
      '10 min ruhig auslaufen.',
    ],
    duration: 'ca. 45 min',
    intensity: 'Niedrig — Technik vor Schnelligkeit',
    tips: [
      'Aufrecht bleiben, Blick nach vorn, Arme aktiv mitführen.',
      'Bodenkontakt kurz und unter dem Körperschwerpunkt halten.',
      'Ideal auf Rasen oder Kunstrasen — schonend und gutes Feedback fürs Fußgewölbe.',
    ],
    equipment: ['none'],
  },
  'cycling-hard-intervals-8min': {
    summary: 'Vier 8-min-Intervalle an der Schwellenleistung für Erholungsfähigkeit und Dauerleistung.',
    howTo: [
      '15–20 min ruhig einfahren, zwei kurze Antritte zur Aktivierung.',
      '8 min zügig fahren: Trittfrequenz 85–95, Puls sollte sich im Intervall stabilisieren.',
      'Zwischen den Intervallen 4 min ganz locker treten.',
      '4 Wiederholungen; danach 10–15 min ausrollen.',
    ],
    duration: 'ca. 75–90 min',
    intensity: 'Intervalle nahe der FTP (ca. 85–92 % HFmax), Pausen locker',
    tips: [
      'Kleine Gänge (Kassette) wählen — weiche Belastung für die Knie.',
      'Auf der Rolle: Lüftung einplanen, sonst überhitzt du schnell.',
      'Wenn das 4. Intervall deutlich einbricht, beim nächsten Mal Pause verlängern.',
    ],
    equipment: ['bike'],
  },
  'cycling-hard-threshold': {
    summary: 'Zwei 20-min-Schwellenblöcke für Dauerleistung und Kraftausdauer.',
    howTo: [
      '20 min einfahren mit 2–3 kurzen Antritten.',
      '20 min am Stück bei Schwellenleistung fahren — hart, aber 20 min haltbar.',
      '5–8 min locker treten lassen.',
      'Zweiten 20-min-Block fahren, dann 10–15 min ausrollen.',
    ],
    duration: 'ca. 75–90 min',
    intensity: 'Schwellenbereich (ca. 88–93 % HFmax)',
    tips: [
      'Ernährung vorab klären — an 2 × 20 min hängt viel.',
      'Trittfrequenz konstant halten statt Gänge zu wechseln.',
      'Bergige Strecke geht auch: Blöcke als Bergfahrt fahren.',
    ],
    equipment: ['bike'],
  },
  'cycling-hard-hills': {
    summary: 'Bergfahrt mit niedriger Trittfrequenz für Beinkraft und Kraftausdauer.',
    howTo: [
      '15–20 min einfahren, danach in einen langen Anstieg oder gegen Wind fahren.',
      'Mit niedriger Trittfrequenz (55–65) und hohem Gang klettern bzw. fahren.',
      '6–10 min pro Belastungsblock, danach locker bergab/talwärts rollen.',
      '3–5 Blöcke, zum Schluss 10–15 min ausrollen.',
    ],
    duration: 'ca. 90–120 min je nach Anfahrt',
    intensity: 'Hart, aber unterhaltbar; Hüfte und Knie müssen sauber bleiben',
    tips: [
      'Nicht in den Knochen wühlen — Rücken und Knie bleiben entspannt.',
      'Bergab bewusst lockern und ausfahren.',
      'Zuhause auf der Rolle: steilen virtuellen Anstieg oder hohen Widerstand nutzen.',
    ],
    equipment: ['bike'],
  },
  'cycling-easy-base': {
    summary: 'Ruhige 60–75-min-Grundlagenausfahrt für Ausdauer und Fettstoffwechsel.',
    howTo: [
      'Ruhig starten und die ersten 15 min bewusst locker treten.',
      '60–75 min in lockerem Tempo fahren — ohne Trittfrequenz-Zwang, aber geschmeidig.',
      'Unterwegs trinken, nicht frieren, nicht schwitzen.',
      'Zuhause kurz dehnen und Nasenne-Pflege fürs Rad.',
    ],
    duration: '60–75 min',
    intensity: 'ca. 55–70 % HFmax, komplett unterhaltbar',
    tips: [
      'Diese Fahrt soll Erholung bringen — keine Strava-Jagd.',
      'Auch Regenwetter machbar; Regenkleidung und Sturzhelm-Visier einpacken.',
      'Ideal als zweite Einheit nach einem harten Tag.',
    ],
    equipment: ['bike'],
  },
  'cycling-easy-long': {
    summary: 'Lange, ruhige Ausfahrt — Ausdauer aufbauen und Trinken & Ernährung unterwegs üben.',
    howTo: [
      '90–180 min in ruhigem Tempo fahren, Pausen nach Bedarf.',
      'Alle 30–45 min trinken; ab 90 min einen Riegel oder Banane essen.',
      'Tempo so wählen, dass du dich durchgehend mitsprechen könntest.',
      'Zum Schluss kurz ausrollen und nach der Fahrt direkt Eiweiß + Kohlenhydrate essen.',
    ],
    duration: '90–180 min',
    intensity: 'ca. 55–70 % HFmax',
    tips: [
      'Ernährung unter Belastung ist Trainingsstoff — hier wird sie geübt.',
      'Route mit Wassernachfüll-Möglichkeit planen.',
      'Bei Gegenwind ruhig eine Runde abkürzen — Distanz ist nicht das Ziel.',
    ],
    equipment: ['bike'],
  },
  'strength-hard-lower': {
    summary: 'Unterkörper-Schwerpunkt: Kniebeuge und Rumänisches Kreuzheben für Beine, hintere Kette und Rumpf.',
    howTo: [
      '10 min Warm-up: Rad/Cardio, Hüftöffner, 2 Sätze mit leerer Stange.',
      'Kniebeuge: 4 Sätze à 5–8 Wiederholungen, 2–3 min Pause. Tiefe bis Oberschenkel parallel oder tiefer.',
      'Rumänisches Kreuzheben: 3 Sätze à 8–10 Wiederholungen, 2 min Pause. Rücken gerade, Hantel nah am Körper.',
      'Optional Beinpresse oder Ausfallschritte: 2 Sätze à 12 Wiederholungen.',
      'Cool-down: Dehnen für Hüftbeuger, Oberschenkel und Gesäß.',
    ],
    duration: 'ca. 60–75 min',
    intensity: 'Last so, dass die letzten 1–2 Wiederholungen sauber aber zäh sind',
    tips: [
      'Technik vor Gewicht — erst Bewegungsqualität, dann Progression.',
      'Immer 1–2 „Saft“-Wiederholungen in der Tasche lassen.',
      'Trainingstagebuch führen, um Progressive Overload zu steuern.',
    ],
    equipment: ['barbell'],
  },
  'strength-hard-squat-core': {
    summary: 'Kniebeuge-Fokus plus Planks für Beine, Gesäß und Rumpfstabilität.',
    howTo: [
      '10 min Warm-up inkl. Mobilität für Hüfte und Knöchel.',
      'Kniebeuge: 5 Sätze à 5 Wiederholungen, schwer aber sauber, 2–3 min Pause.',
      'Frontkniebeuge leicht: 2 Sätze à 8 Wiederholungen für Haltung und Rumpf.',
      'Planks: 3 × 30–45 s, dazu Seitstütze 2 × 20–30 s je Seite.',
      'Cool-down: kurzes Dehnen, Faszienrolle für Oberschenkel und Gesäß.',
    ],
    duration: 'ca. 50–65 min',
    intensity: 'Hauptübung schwer (5-Wdh-Bereich), Zusatzübungen moderat',
    tips: [
      'Bei Knick-Stabilität im Knie achten: Knie folgt der Fußspitze.',
      'Bauchspannung vor jeder Wiederholung aktiv aufbauen („Brace“).',
      'Planks so lange halten, bis die Hüfte einsackt — lieber kürzer und sauber.',
    ],
    equipment: ['barbell'],
  },
  'strength-hard-bodyweight-legs': {
    summary: 'Unterkörpertraining ohne Geräte mit Kniebeugen, Hüftstreckung und Wadenkraft.',
    howTo: [
      '5–8 min zügig gehen und Hüfte, Knie und Sprunggelenke mobilisieren.',
      'Kniebeugen: 4 × 12–20 kontrollierte Wiederholungen, 90 s Pause.',
      'Einbeinige Glute Bridges: 3 × 10–15 je Seite; Becken oben kurz halten.',
      'Rückwärts-Ausfallschritte: 3 × 8–12 je Bein, Knie stabil führen.',
      'Wadenheben: 3 × 15–25; langsam absenken.',
    ],
    duration: 'ca. 35–45 min',
    intensity: 'Moderat; sauber beenden, bevor die Technik nachlässt',
    tips: ['Bei Bedarf einen Rucksack als Zusatzgewicht nutzen.', 'Knie folgen den Fußspitzen; schmerzfrei trainieren.'],
    equipment: ['none'],
  },
  'strength-hard-bodyweight-unilateral': {
    summary: 'Einbeiniger Schwerpunkt zur Verbesserung von Balance und Beinkraft — ohne Geräte.',
    howTo: [
      '5–8 min aufwärmen, dann je Seite 8 langsame Ausfallschritte.',
      'Bulgarian Split Squats an einer stabilen Stufe oder einem Stuhl: 3 × 8–12 je Bein.',
      'Einbeinige Hüftbeugen ohne Gewicht: 3 × 8–12 je Seite, Rücken lang.',
      'Glute Bridge: 3 × 15–20; oben zwei Sekunden halten.',
      'Seitstütz: 3 × 20–40 s je Seite.',
    ],
    duration: 'ca. 35–45 min',
    intensity: 'Moderat; Gleichgewicht und Bewegungsqualität vor Wiederholungszahl',
    tips: ['Bei Unsicherheit an einer Wand abstützen.', 'Beide Seiten mit derselben Wiederholungszahl trainieren.'],
    equipment: ['none'],
  },
  'strength-hard-bodyweight-full': {
    summary: 'Ganzkörperzirkel mit Körpergewicht für Kraftausdauer und Rumpfstabilität.',
    howTo: [
      '5–8 min locker aufwärmen.',
      '3–4 Runden: 12–20 Kniebeugen, 8–15 Liegestütze, 10 Rückwärts-Ausfallschritte je Seite.',
      'Nach jeder Runde 60–90 s pausieren; Übungen kontrolliert ausführen.',
      'Zum Abschluss 3 × 30–45 s Plank und 5 min lockeres Dehnen.',
    ],
    duration: 'ca. 30–40 min',
    intensity: 'Moderat bis fordernd; Liegestütze bei Bedarf erhöht an einer stabilen Fläche',
    tips: ['Lieber weniger Wiederholungen mit guter Haltung.', 'Knie oder erhöhte Hände sind leichtere Liegestütz-Varianten.'],
    equipment: ['none'],
  },
  'strength-easy-bodyweight-push': {
    summary: 'Oberkörper-Drücken und Rumpftraining ohne Hanteln oder Bank.',
    howTo: [
      '5 min Schulterkreisen und lockere Armbewegungen.',
      'Liegestütze: 4 × 6–15; Variante passend wählen (Wand, erhöht, Knie oder Boden).',
      'Pike Push-ups oder erhöhte Liegestütze: 3 × 6–12 für Schultern.',
      'Enge Liegestütze: 2 × 6–12, nur solange Handgelenke und Schultern schmerzfrei bleiben.',
      'Dead Bug: 3 × 8–12 je Seite.',
    ],
    duration: 'ca. 30–40 min',
    intensity: 'Leicht bis moderat; 2–3 Wiederholungen in Reserve lassen',
    tips: ['Körper in einer Linie halten und kontrolliert absenken.', 'Bei Schmerzen Übung abbrechen oder vereinfachen.'],
    equipment: ['none'],
  },
  'strength-easy-bodyweight-posture': {
    summary: 'Leichtes Oberkörper- und Haltungstraining ohne Geräte.',
    howTo: [
      '5 min mobilisieren: Schulterkreisen, Brustwirbelsäule drehen, Arme heben.',
      'Bird Dog: 3 × 8–12 je Seite, Becken ruhig halten.',
      'Reverse Snow Angels in Bauchlage: 3 × 10–15 langsam.',
      'Scapular Push-ups: 3 × 10–15, Arme gestreckt lassen.',
      'Seitstütz auf Knien oder Füßen: 2–3 × 20–30 s je Seite.',
    ],
    duration: 'ca. 25–35 min',
    intensity: 'Leicht; Fokus auf kontrollierte Bewegung und Beweglichkeit',
    tips: ['Kein Schwung und kein Hohlkreuz.', 'Diese Einheit soll sich erholsam anfühlen.'],
    equipment: ['none'],
  },
  'strength-easy-bodyweight-core': {
    summary: 'Rumpf- und Beweglichkeitseinheit als gerätefreie Alternative am leichten Tag.',
    howTo: [
      '5 min locker aufwärmen und Wirbelsäule mobilisieren.',
      'Dead Bug: 3 × 8–12 je Seite.',
      'Glute Bridge: 3 × 12–20 kontrollierte Wiederholungen.',
      'Bird Dog: 3 × 8–12 je Seite, jede Wiederholung kurz halten.',
      'Plank und Seitstütz: je 3 × 20–40 s; zum Schluss sanft dehnen.',
    ],
    duration: 'ca. 25–35 min',
    intensity: 'Leicht bis moderat; Atmung ruhig halten',
    tips: ['Lendenwirbelsäule nicht ins Hohlkreuz ziehen.', 'Bei Müdigkeit eine Runde weglassen.'],
    equipment: ['none'],
  },
  'strength-easy-upper': {
    summary: 'Oberkörper-Tag: Bankdrücken, Rudern und Überkopfdrücken für Brust, oberen Rücken und Schultern.',
    howTo: [
      '8–10 min Warm-up: Schulterkreisen, Band-Pull-aparts, leichte Sätze.',
      'Bankdrücken: 4 Sätze à 8–10 Wiederholungen, 90–120 s Pause.',
      'Rudern (Kabel oder Kurzhantel): 4 Sätze à 10 Wiederholungen.',
      'Überkopfdrücken: 3 Sätze à 8–10 Wiederholungen.',
      'Optional Klimmzüge oder Latzziehen: 2–3 Sätze.',
      'Cool-down: Brust- und Schulterdehnung.',
    ],
    duration: 'ca. 50–60 min',
    intensity: 'Moderat; 1–2 Wiederholungen Reserve pro Satz',
    tips: [
      'Zug- und Druckübungen im Verhältnis 1:1 — schützt die Schulter.',
      'Rücken bleibt am Rudern angespannt, kein Schwung aus dem Lendenwirbelsäulenbereich.',
      'Bei Schulterproblemen: Überkopfdrücken gegen Landmine-Press tauschen.',
    ],
    equipment: ['dumbbells', 'bench'],
  },
  'strength-easy-pull': {
    summary: 'Klimmzüge/Latzziehen und Rudern für Rücken, Bizeps und Haltung.',
    howTo: [
      'Warm-up mit Bandübungen für Schultern und leichtem Cardio.',
      'Klimmzüge oder Latzziehen: 4 Sätze à 6–10 Wiederholungen (bei Bedarf mit Widerstand).',
      'Rudern einarmig oder am Kabel: 3 Sätze à 10–12 Wiederholungen je Seite.',
      'Bizeps-Curls und Face-Pulls je 2 Sätze à 12–15 Wiederholungen.',
      'Cool-down: Dehnen für Lat, Bizeps und Nacken.',
    ],
    duration: 'ca. 45–55 min',
    intensity: 'Moderat; letzte Wiederholungen spürbar, keine Ausfallserscheinungen',
    tips: [
      'Klimmzüge sauber aus voller Streckung ziehen, kein Schwung.',
      'Schulterblätter bewusst bewegen — „in die Tasche ziehen“.',
      'Als zweite Einheit an harten Tagen gut kombinierbar.',
    ],
    equipment: ['pullup'],
  },
  'team-hard-sprints': {
    summary: 'Acht 30-m-Sprints für Schnelligkeit und Antritt.',
    howTo: [
      '10 min einlaufen, Mobilisation für Hüfte und Knöchel.',
      '2 × 20 m anlaufende Steigerungen zur Vorbereitung.',
      '8 × 30 m Sprint mit max. Antritt, dazwischen jeweils 2–3 min Gehen als Pause.',
      '5 min auslaufen, kurzes Dehnen der Beinrückseite.',
    ],
    duration: 'ca. 45–60 min',
    intensity: 'Sprintvolle Intensität, Pausen vollständig zur Erholung',
    tips: [
      'Nur mit vollständig aufgewärmten Hamstrings sprinten.',
      'Aus dem Stand starten, Fokus auf die ersten drei Schritte.',
      'Bei ziehendem Oberschenkel sofort abbrechen.',
    ],
    equipment: ['track'],
  },
  'team-hard-agility': {
    summary: 'Richtungswechsel-Drills plus Sprünge für Agilität, Bremskraft und Sprungkraft.',
    howTo: [
      '10 min einlaufen inkl. Stufen- und Seilspringen zur Aktivierung.',
      'Richtungswechsel: 5-0-5-Test-Drill, Zickzack durch 5 Hütchen — 6–8 Durchgänge mit voller Erholung.',
      'Sprünge: 3 × 5 Drop-Jumps (von Kasten, direkt abspreizen), dazwischen 90 s Pause.',
      'Einbeinige Sprünge: 2 × 5 je Bein für Stabilität.',
      'Auslaufen und Dehnen.',
    ],
    duration: 'ca. 50–60 min',
    intensity: 'Jeder Sprung und Wechsel explosiv, dazwischen volle Erholung',
    tips: [
      'Qualität zählt: Knie stabil, Landung weich, kein Einknicken.',
      'Auf Rasen oder Hallenboden trainieren, nicht auf Beton.',
      'Wenn die Landungen unsauber werden, Pause verlängern.',
    ],
    equipment: ['none'],
  },
  'team-hard-jumps': {
    summary: 'Sprungkraft-Block mit Kniehebe- und Hürdensprüngen für Schnellkraft.',
    howTo: [
      '10 min Warm-up, inkl. 20 Seilsprüngen und Bein-Mobilisation.',
      'Kniehebesprünge: 4 × 6 Sprünge, Beine aktiv zum Bauch ziehen.',
      'Hürdensprünge über 5 Hürden: 4 Durchgänge, minimaler Bodenkontakt.',
      'Einbeiniger Weitsprung: 3 × 3 je Bein, Landung stabil halten (2 s).',
      'Auslaufen, Waden und Hamstrings dehnen.',
    ],
    duration: 'ca. 45–55 min',
    intensity: 'Maximale Sprunghöhe/-weite, volle Erholung zwischen Sätzen',
    tips: [
      'Kontaktzeiten kurz halten — „auf heiße Kohlen“ springen.',
      'Zwischen den Sätzen ausgiebig pausieren: Schnellkraft braucht Frische.',
      'Nicht an aufeinanderfolgenden Tagen mit Sprints kombinieren.',
    ],
    equipment: ['none'],
  },
  'team-easy-coordination': {
    summary: 'Koordinationsleiter plus Technikdrills für Fußarbeit und Schrittfrequenz.',
    howTo: [
      '10 min locker einlaufen.',
      'Koordinationsleiter: 6–8 verschiedene Muster (Einbein, Doppelschritt, seitlich), je 2 Durchgänge.',
      'Ball-Technik: 15 min Passen, Dribbeln oder Richtungswechsel mit Ball.',
      '5 min auslaufen und kurz dehnen.',
    ],
    duration: 'ca. 40–50 min',
    intensity: 'Niedrig bis moderat — sauber und konzentriert',
    tips: [
      'Geschwindigkeit nur so hoch, dass die Muster sauber bleiben.',
      'Arme bewusst einsetzen — sie steuern die Frequenz.',
      'Gut auch am Tag vor einem Spiel als Aktivierung.',
    ],
    equipment: ['balls'],
  },
  'team-easy-aerobic': {
    summary: 'Lockere Ausdauereinheit für Grundlage und Erholung zwischen harten Tagen.',
    howTo: [
      '30–45 min locker laufen oder radeln — komplett unterhaltbar.',
      'Zum Abschluss 10 min lockeres Dehnen und Mobilität für Hüfte, Waden, Hamstrings.',
      'Durstig bleiben: auch bei „leicht“ läuft der Flüssigkeitshaushalt.',
    ],
    duration: '30–45 min',
    intensity: 'ca. 55–70 % HFmax',
    tips: [
      'Diese Einheit soll die Regeneration unterstützen, nicht belasten.',
      'Beinbeschwerden? Radeln oder Gehen statt Laufen.',
      'Auch gut mit Technik-Material (Ball, Leiter) kombinierbar.',
    ],
    equipment: ['none'],
  },
  'combat-hard-sparring': {
    summary: 'Sparring für Timing, Distanzgefühl und Wettkampfausdauer.',
    howTo: [
      '15 min Warm-up: Seilspringen, Schattenkampf leicht, Mobilisation des Nackens.',
      'Technisches Sparring: 4–6 Runden à 3 min, 1 min Pause. Kontrolle statt KO-Absicht.',
      'Zwischendrin kurze Reflexion mit Partner: Was hat geklappt, was nicht?',
      'Cool-down: lockeres Schattenkampfen, Nacken- und Schulterdehnung.',
    ],
    duration: 'ca. 60–75 min',
    intensity: 'Hoch, aber kontrolliert — Tempowechsel nach Absprache',
    tips: [
      'Schutzausrüstung (Zahnstangen, Bandagen) immer.',
      'Ego an der Tür lassen: Lernen statt Beweisen.',
      'Vor einem Wettkampf Umfang reduzieren, dafür Qualität steigern.',
    ],
    equipment: ['pads'],
  },
  'combat-hard-pads': {
    summary: 'Pratzenarbeit für Schlagkraft, Präzision und Kondition.',
    howTo: [
      '10 min Warm-up: Seilspringen und leichte Kombinationen in die Luft.',
      'Pratzen: 6 × 3 min mit Kombinationen (Einzel- und Mehrfachtechniken, Kombinationen mit Beinen).',
      'Zwischen den Runden 1 min Pause, Pratzenhalter wechselt auf Power- oder Speed-Fokus.',
      'Zum Schluss 3 × 30 s „Finisher“ mit höchster Frequenz.',
      'Ausklang: lockeres Schattenkampfen und Dehnen.',
    ],
    duration: 'ca. 50–60 min',
    intensity: 'Rundenweise hoch, Finisher maximal',
    tips: [
      'Trefferfläche und Hüfteinsatz bewusst nutzen — Kraft aus dem Boden.',
      'Bandagen und Boxhandschuhe passen? Kontrolle vor jeder Einheit.',
      'Technik sauber halten, auch (besonders) bei Müdigkeit.',
    ],
    equipment: ['pads'],
  },
  'combat-hard-circuit': {
    summary: 'Konditionszirkel mit Burpees, Seilspringen und Kettlebell-Swings für Ausdauer und Explosivität.',
    howTo: [
      '10 min Warm-up inkl. 1–2 lockeren Zirkel-Durchgängen.',
      'Zirkel: 40 s Belastung / 20 s Wechsel, 4 Runden — Burpees, Seilspringen, Kettlebell-Swings, Ausfallschritte, Mountain Climbers.',
      'Zwischen den Runden 2 min Pause.',
      'Cool-down: 5 min lockeres Gehen, Dehnen für Waden, Hüfte und Rücken.',
    ],
    duration: 'ca. 45–55 min',
    intensity: 'Hoch; Bewegungsqualität bleibt Vorrang vor Rundenzahl',
    tips: [
      'Swings mit Hüftstreckung, nicht mit Armen — heiße Glut in der Hüfte.',
      'Bei Formverlust im Zirkel: Übung wechseln oder Pause einlegen.',
      'Kettlebell-Gewicht konservativ wählen, lieber mehr Wiederholungen.',
    ],
    equipment: ['kettlebell'],
  },
  'combat-easy-technique': {
    summary: 'Technikdrills und Kombinationen für saubere Ausführung und Reaktion.',
    howTo: [
      '10 min Warm-up mit Seilspringen und lockerem Schattenkampf.',
      'Technik: 3–4 Kombinationen langsam aufbauen, Partner oder allein vor dem Spiegel.',
      'Reaktion: Partner ruft Techniken, du reagierst — 4 × 2 min.',
      'Cool-down: Nacken- und Schultermobilisation.',
    ],
    duration: 'ca. 45–55 min',
    intensity: 'Niedrig bis moderat — Kopf einschalten',
    tips: [
      'Langsam üben heißt sauber üben — Schnelligkeit kommt von selbst.',
      'Kamera nutzen: Video-Feedback entlarvt schlechte Gewohnheiten.',
      'Diese Einheit auch am Tag vor Sparring gut machbar.',
    ],
    equipment: ['pads'],
  },
  'combat-easy-shadow': {
    summary: 'Schattenkampf für Beweglichkeit und Technik ohne Partner.',
    howTo: [
      '5 min Seilspringen oder einlaufen.',
      '10–15 min Schattenkampf: Kombinationen, Beinarbeit, Winkelwechsel — light und variabel.',
      'Bewusst Übungen aus dem letzten Techniktraining einbauen.',
      'Cool-down: Dehnen für Hüfte, Waden und Schultern.',
    ],
    duration: 'ca. 30–40 min',
    intensity: 'Niedrig — Bewegung und Denken, kein Sprint',
    tips: [
      'Vor dem Spiegel oder Video: Stand und Deckung prüfen.',
      'Beinarbeit nicht vergessen — 30 % der Zeit nur für Schritte und Winkel.',
      'Auch zuhause ohne Material durchführbar.',
    ],
    equipment: ['none'],
  },
}

export const WORKOUT_LIBRARY: Record<Sport, WorkoutLibrary> = {
  running: {
    hard: [
      { key: 'running-hard-intervals-800', label: 'Intervalle 6 × 800 m (Tempo, VO₂max, Laufökonomie)' },
      { key: 'running-hard-tempo', label: 'Tempodauerlauf (Laktatschwelle, zügige Ausdauer)' },
      { key: 'running-hard-intervals-400', label: 'Intervalle 8 × 400 m (Schnelligkeit, VO₂max)' },
    ],
    easy: [
      { key: 'running-easy-long', label: 'Langer Lauf (Grundlagenausdauer, Fettstoffwechsel, mentale Ausdauer)' },
      { key: 'running-easy-steady', label: 'Ruhiger Dauerlauf 40–50 min + Steigerungsläufe (Laufrhythmus)' },
      { key: 'running-easy-abc', label: 'Lauf-ABC: Kniehebelauf, Anfersen, Skippings (Technik, Koordination)' },
    ],
    rest: [
      { key: 'rest-day-mobility', label: 'Ruhetag: Spaziergang, Mobility' },
      { key: 'rest-day-mobility', label: 'Ruhetag: Dehnen, Fußgelenk-Stabilität' },
    ],
    supplements: [
      'Ausfallschritte & Wadenheben (Beinkraft, Prävention)',
      'Planks (Rumpfstabilität, ökonomische Haltung)',
    ],
  },
  cycling: {
    hard: [
      { key: 'cycling-hard-intervals-8min', label: 'Intervalle 4 × 8 min (Schwellenleistung, Erholungsfähigkeit)' },
      { key: 'cycling-hard-threshold', label: 'Schwellentraining 2 × 20 min (Dauerleistung, Kraftausdauer)' },
      { key: 'cycling-hard-hills', label: 'Bergfahrt / Kraftausdauer, niedrige Trittfrequenz (Beinkraft)' },
    ],
    easy: [
      { key: 'cycling-easy-base', label: 'Grundlagenausfahrt 60–75 min, locker (Ausdauer, Fettstoffwechsel)' },
      { key: 'cycling-easy-long', label: 'Lange Ausfahrt (Ausdauer, Trinken & Ernährung unterwegs üben)' },
    ],
    rest: [
      { key: 'rest-day-mobility', label: 'Ruhetag: Dehnen, Fahrrad-Check' },
      { key: 'rest-day-mobility', label: 'Ruhetag: Spaziergang, Mobility' },
    ],
    supplements: [
      'Kniebeugen & Kreuzheben (Kraft pro Tritt)',
      'Planks & Rückenstrecker (Rumpf, Haltung auf langen Ausfahrten)',
    ],
  },
  strength: {
    hard: [
      { key: 'strength-hard-lower', label: 'Schwerpunkt Unterkörper: Kniebeuge, Rumänisches Kreuzheben (Beine, hintere Kette, Rumpf)' },
      { key: 'strength-hard-squat-core', label: 'Kniebeuge-Fokus + Planks (Beine, Gesäß, Rumpfstabilität)' },
      { key: 'strength-hard-bodyweight-legs', label: 'Unterkörper ohne Geräte: Kniebeugen, Ausfallschritte & Waden' },
      { key: 'strength-hard-bodyweight-unilateral', label: 'Einbeinige Beinkraft & Balance (ohne Geräte)' },
      { key: 'strength-hard-bodyweight-full', label: 'Ganzkörperzirkel mit Körpergewicht' },
    ],
    easy: [
      { key: 'strength-easy-upper', label: 'Oberkörper: Bankdrücken, Rudern, Überkopfdrücken (Brust, oberer Rücken, Schultern)' },
      { key: 'strength-easy-pull', label: 'Klimmzüge/Latzziehen & Rudern (Rücken, Bizeps, Haltung)' },
      { key: 'strength-easy-bodyweight-push', label: 'Oberkörper-Drücken & Rumpf (ohne Geräte)' },
      { key: 'strength-easy-bodyweight-posture', label: 'Haltung & Rumpf ohne Geräte' },
      { key: 'strength-easy-bodyweight-core', label: 'Rumpf & Beweglichkeit (ohne Geräte)' },
    ],
    rest: [
      { key: 'rest-day-mobility', label: 'Ruhetag: Mobilität, leichtes Cardio' },
      { key: 'rest-day-mobility', label: 'Ruhetag: Planks & Mobility (Rumpf, Beweglichkeit)' },
    ],
    supplements: [
      'Nordics & Wadenheben (Prävention)',
      'Klimmzüge (Rücken, Bizeps)',
    ],
  },
  team: {
    hard: [
      { key: 'team-hard-sprints', label: 'Sprints 8 × 30 m (Schnelligkeit, Antritt)' },
      { key: 'team-hard-agility', label: 'Richtungswechsel-Drills + Sprünge (Agilität, Bremskraft, Sprungkraft)' },
      { key: 'team-hard-jumps', label: 'Sprungkraft: Kniehebe- & Hürdensprünge (Schnellkraft)' },
    ],
    easy: [
      { key: 'team-easy-coordination', label: 'Koordinationsleiter + Technik (Fußarbeit, Schrittfrequenz)' },
      { key: 'team-easy-aerobic', label: 'Lockere Ausdauer (Grundlage, Erholung zwischen harten Tagen)' },
    ],
    rest: [
      { key: 'rest-day-mobility', label: 'Ruhetag: Regeneration, Mobility' },
      { key: 'rest-day-mobility', label: 'Ruhetag: lockeres Einlaufen, Dehnen' },
    ],
    supplements: [
      'Ausfallschritte & Kniebeugen (Beinkraft, Kniestabilität)',
      'Nordic Hamstring (Hamstrings, Verletzungsprävention)',
    ],
  },
  combat: {
    hard: [
      { key: 'combat-hard-sparring', label: 'Sparring (Timing, Distanzgefühl, Wettkampfausdauer)' },
      { key: 'combat-hard-pads', label: 'Pratzenarbeit (Schlagkraft, Präzision, Kondition)' },
      { key: 'combat-hard-circuit', label: 'Konditionszirkel: Burpees, Seilspringen, Kettlebell-Swings (Ausdauer, Explosivität)' },
    ],
    easy: [
      { key: 'combat-easy-technique', label: 'Technikdrills & Kombinationen (saubere Technik, Reaktion)' },
      { key: 'combat-easy-shadow', label: 'Schattenkampf (Beweglichkeit, Technik ohne Partner)' },
    ],
    rest: [
      { key: 'rest-day-mobility', label: 'Ruhetag: Mobility & Dehnen (Beweglichkeit, Prävention)' },
      { key: 'rest-day-mobility', label: 'Ruhetag: Atemarbeit, lockeres Schattenkampfen' },
    ],
    supplements: [
      'Rumpf: Russian Twists, Beinheben (Rotationskraft, Schlagübertragung)',
      'Zusatz: explosive Kombinationen am Sack',
    ],
  },
}

/** Ergänzung für einen Tag (null an Ruhetagen oder ohne Ergänzungen). */
export function supplementFor(sport: Sport, kind: DayKind, rank: number): string | null {
  const lib = WORKOUT_LIBRARY[sport]
  if (kind === 'rest' || lib.supplements.length === 0) return null
  return lib.supplements[rank % lib.supplements.length]
}

/** Gerätebedarf derselben Ergänzungsrotation, damit Pro-Vorschläge passen. */
export function supplementEquipmentFor(sport: Sport, rank: number): Equipment[] {
  const needs: Record<Sport, Equipment[][]> = {
    running: [['none'], ['none']],
    cycling: [['barbell'], ['none']],
    strength: [['none'], ['pullup']],
    team: [['none'], ['none']],
    combat: [['none'], ['pads']],
  }
  const options = needs[sport]
  return options[rank % options.length]
}

/** Haupt-Einheiten (ohne Ergänzung) als Schlüssel-Liste, aus denen pro Tag gewählt werden kann. */
export function workoutOptionsFor(sport: Sport, kind: DayKind): { key: WorkoutKey; label: string }[] {
  const lib = WORKOUT_LIBRARY[sport]
  return kind === 'hard' ? lib.hard : kind === 'easy' ? lib.easy : lib.rest
}

/** Detaillierter Guide zu einer Haupt-Einheit. */
export function guideFor(key: WorkoutKey): WorkoutGuide {
  return WORKOUT_GUIDES[key]
}

/**
 * Wählt die Einheit für einen Tag so, dass innerhalb einer Woche keine
 * Einheit doppelt vorkommt (solange der Pool reicht). `rank` ist der
 * nullbasierte Index dieses Tages unter allen Tagen derselben Art. Optionen
 * können vorher nach Ausrüstung gefiltert und manuell reservierte Labels
 * ausgeschlossen werden; Rerolls verschieben die Rotation.
 */
export function workoutForWeek(
  sport: Sport,
  kind: DayKind,
  weekSeed: number,
  rank: number,
  options: { key: WorkoutKey; label: string }[] = workoutOptionsFor(sport, kind),
  excludedLabels: ReadonlySet<string> = new Set(),
): { key: WorkoutKey; label: string } | undefined {
  const available = options.filter((option) => !excludedLabels.has(option.label))
  // Wenn mehr Trainingstage als Varianten vorhanden sind, wird Wiederholung
  // unvermeidbar; dann wieder den ganzen (ggf. equipment-gefilterten) Pool nutzen.
  const pool = available.length > 0 ? available : options
  if (pool.length === 0) return undefined
  const offset = (((weekSeed + rank) % pool.length) + pool.length) % pool.length
  return pool[offset]
}

/** Anzeige-Name der Sportart. */
export function sportLabel(sport: Sport): string {
  const labels: Record<Sport, string> = {
    running: 'Laufen',
    cycling: 'Radfahren',
    strength: 'Kraftsport',
    team: 'Teamsport',
    combat: 'Kampfsport',
  }
  return labels[sport]
}
