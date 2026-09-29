# FitPlan

Wochenplaner für Training + Ernährung (Vite + React 18 + TypeScript + Tailwind CSS v4).

**Features:** Onboarding (Sportart, Ziel, Ernährungsform, Körperdaten, Trainingstage),
Wochenansicht mit Kalorien-Balken (harte Tage = mehr Kohlenhydrate, Ruhetage = weniger),
Tagesplan mit 4 Mahlzeiten und konkreten Mengen, Foto-Pflicht für Mahlzeiten-Checks,
private Cloud-Synchronisierung von Fotos/Checks/Profil über Supabase, automatisch
generierte Einkaufsliste, Gewichts-Tracking und Gratis/Pro-Trennung (Demo-Upgrade;
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

## Supabase Cloud Sync

1. Erstelle ein Supabase-Projekt.
2. Kopiere `.env.example` nach `.env.local`; fülle `VITE_SUPABASE_URL` und
   `VITE_SUPABASE_ANON_KEY` mit Project URL und dem öffentlichen anon/publishable
   Key und starte Vite neu. **Nie** den `service_role`-Key im Frontend verwenden.
3. Führe `supabase/setup.sql` im Supabase SQL Editor als Projekt-Administrator aus.
   Das erstellt `user_profiles`, `day_checks`, Row-Level-Security-Policies und
   den privaten `fitplan-meal-photos` Bucket. PostgreSQL Changes für die Tabelle
   müssen in `supabase_realtime` veröffentlicht sein (das Skript fügt sie hinzu).
4. In Supabase Auth E-Mail-Registrierung aktivieren und lokale/deployed URLs in
   Authentication → URL Configuration als Site URL / Redirect URLs eintragen.
   Für Tests lässt sich die E-Mail-Bestätigung deaktivieren; produktiv sollte sie
   aktiviert bleiben.
5. App in zwei Browsern/Geräten mit demselben Konto anmelden. Mahlzeitfoto
   aufnehmen/auswählen: die App komprimiert das Bild, entfernt Metadaten durch
   JPEG-Neukodierung, lädt es privat hoch und setzt erst danach den Check.
   Häkchen/Foto löschen oder Foto ersetzen wird ebenfalls synchronisiert.

Fotos sind pro Nutzer geschützt, signierte Vorschau-URLs laufen nach einer Stunde
ab und werden beim Laden des aktuellen Wochenplans neu erzeugt. Die lokalen alten
Trainings-Häkchen werden bei der ersten Anmeldung einmalig übernommen; alte
Mahlzeiten-Häkchen ohne verknüpftes Foto werden absichtlich nicht importiert.

## Layout

- `index.html` — entry point
- `src/main.tsx` — React bootstrap
- `src/domain/` — Typen, Rezepte, Ernährungs-Mathematik, Wochenplan-Builder, Einkaufsliste
- `src/hooks/` — Profil, Auth, synchronisierte Checks/Fotos, Gewichte, Workout-Auswahl, Pro-Status
- `src/components/` — Onboarding, WeekView, DayView, ShoppingList, ProgressPanel, AuthGate
- `src/index.css` — global styles (Tailwind import)
- `supabase/setup.sql` — Cloud schema, RLS and private storage policies
- `reference/claude-assets/` — archived browser assets saved from claude.ai, kept
  only for visual reference. They are third-party material and are **not** part of
  the app; nothing in `src/` references them.

## Deploy

Die App ist statisch; Fotos und Nutzer-Sync laufen über Supabase.

- **Netlify:** Repository verbinden; `netlify.toml` verwendet `npm run build`,
  veröffentlicht `dist` und aktiviert den SPA-Fallback. Die zwei `VITE_SUPABASE_*`
  Variablen zusätzlich in Netlify als Build-Umgebungsvariablen setzen.
- **Vercel:** Framework „Vite“ wählen, Build-Befehl `npm run build` und Output-
  Verzeichnis `dist` verwenden; dieselben Build-Umgebungsvariablen setzen.
