# FitPlan

Wochenplaner für Training + Ernährung (Vite + React 18 + TypeScript + Tailwind CSS v4).

**Features:** Onboarding (Sportart, Ziel, Ernährungsform, Körperdaten, Trainingstage),
Wochenansicht mit Kalorien-Balken (harte Tage = mehr Kohlenhydrate, Ruhetage = weniger),
Tagesplan mit 4 Mahlzeiten und konkreten Mengen, Abhaken pro Woche, automatisch
generierte Einkaufsliste, Gewichts-Tracking, Gratis/Pro-Trennung (Demo-Upgrade;
für Produktion RevenueCat/Stripe anbinden).

**Hinweis:** Die Berechnung ist eine Schätzung (Mifflin-St Jeor) und ersetzt keine
Ernährungsberatung — das steht auch so in der App.

## Run it

```bash
npm install
npm run dev      # dev server with HMR
npm run build    # typecheck + production build (outputs to dist/)
npm run preview  # serve the production build locally
```

## Layout

- `index.html` — entry point
- `src/main.tsx` — React bootstrap
- `src/domain/` — Typen, Rezepte, Ernährungs-Mathematik, Wochenplan-Builder, Einkaufsliste
- `src/hooks/` — Persistenz-Hooks (Profil, Checks, Gewichte, Workout-Auswahl, Pro-Status)
- `src/components/` — Onboarding, WeekView, DayView, ShoppingList, ProgressPanel, Paywall
- `src/index.css` — global styles (Tailwind import)
- `reference/claude-assets/` — archived browser assets saved from claude.ai, kept
  only for visual reference. They are third-party material and are **not** part of
  the app; nothing in `src/` references them.

## Deploy

Die App ist statisch und benötigt für den Frontend-Betrieb kein Backend.

- **Netlify:** Repository verbinden; `netlify.toml` verwendet `npm run build`,
  veröffentlicht `dist` und aktiviert den SPA-Fallback.
- **Vercel:** Framework „Vite“ wählen, Build-Befehl `npm run build` und Output-
  Verzeichnis `dist` verwenden.
