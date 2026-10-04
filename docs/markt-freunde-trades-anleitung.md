# Marktplatz, Freunde und Trades einrichten

Die App enthält die Oberfläche und serverseitig validierte Supabase-Funktionen. Damit Freunde, Tauschen und Handeln live funktionieren, müssen die Datenbankskripte **einmalig in der richtigen Reihenfolge** im Supabase-Projekt ausgeführt werden.

## 1. Supabase-Projekt öffnen

1. Öffne das FitPlan-Projekt im [Supabase-Dashboard](https://supabase.com/dashboard).
2. Wähle **SQL Editor** und erstelle eine neue Abfrage.
3. Öffne den vollständigen Inhalt von [supabase/setup.sql](../supabase/setup.sql) und führe ihn aus.
4. Erwarte „Success. No rows returned“ (oder eine Erfolgsmeldung). Bei einem Fehler die erste Fehlermeldung beheben, nicht mit dem nächsten Skript fortfahren.

Dieses Basisskript richtet u. a. private Profile, Anmeldedaten für Sync und die Datenbanktabellen der App ein. Es ist idempotent und kann erneut ausgeführt werden.

## 2. Marktplatz-, Freundes- und Trade-Funktionen bereitstellen

1. Öffne eine zweite Abfrage im Supabase SQL Editor.
2. Füge den **gesamten Inhalt** von [supabase/collection-setup.sql](../supabase/collection-setup.sql) ein und führe ihn aus.
3. Prüfe, dass keine SQL-Fehler gemeldet wurden.

Das Skript richtet Wallet-/Inventar-, Freundschafts-, Trade- und Markttabellen ein. Es erstellt außerdem die atomaren RPCs (serverseitige Transaktionen) und das getrennte öffentliche Marktprofil. Ein Markt-Spitzname ist öffentlich lesbar; Fitnessprofil-Daten werden dafür nicht verwendet. Die Account-ID selbst ist kein Passwort, sollte aber nur mit gewünschten Freunden geteilt werden.

Falls Realtime im Dashboard nicht verfügbar ist oder das Skript einen Hinweis dazu meldet, öffne **Database → Publications → supabase_realtime** und aktiviere die Tabellen `friends`, `trades`, `market_listings`, `market_transactions`, `market_profiles` und `collections`. Das beeinflusst nur die Live-Aktualisierung; bei aktivierter Tabellen-/RPC-Konfiguration kann ein manueller Reload weiterhin Daten laden.

## 3. Deployment prüfen

Nach den beiden Skripten sollte Supabase **Database → Tables** mindestens diese Tabellen anzeigen:

- `collections`
- `market_profiles`
- `friends`
- `trades`
- `market_listings`
- `market_transactions`

Unter **Database → Functions** sollten unter anderem `set_market_display_name`, `send_friend_request`, `respond_friend_request`, `remove_friend`, `create_trade`, `respond_trade`, `cancel_trade`, `create_listing`, `cancel_listing` und `buy_listing` vorhanden sein.

## 4. Zwei Testkonten vorbereiten

1. Verwende zwei unterschiedliche FitPlan-Konten in zwei Browserprofilen oder auf zwei Geräten.
2. Melde dich bei beiden Konten an und öffne **Sammlung**.
3. Lass beide Nutzer einen Markt-Spitznamen mit 2–24 Zeichen speichern.
4. In beiden Konten in der Box **Freunde** die eigene **Freundes-ID** kopieren. Der Knopf „ID kopieren“ benötigt den Browser-Zugriff auf die Zwischenablage; falls dieser gesperrt ist, lässt sich die angezeigte UUID manuell markieren und kopieren.
5. Auf Konto A die ID von Konto B in das UUID-Feld einfügen und **Anfragen** drücken.
6. Auf Konto B sollte eine Anfrage mit dem öffentlichen Spitznamen von A erscheinen. Dort **Annehmen** drücken.
7. Beide Seiten sollten einander in der Freundesliste sehen. Wird die Anfrage nicht direkt sichtbar, einmal die Seite neu laden.

## 5. Tausch Ende-zu-Ende testen

1. Beide Testkonten brauchen mindestens eine Gewichtsplatte im Inventar. Falls nötig, im Wochenplan einen neuen Check abschließen, damit eine Belohnung entsteht.
2. Auf Konto A einen Freund auswählen. Mindestens eine eigene Platte und mindestens eine gewünschte Katalogplatte auswählen; dann **Tausch-Angebot senden**.
3. Konto B muss unter **Eingang** das Angebot sehen und **Annehmen** drücken.
4. Prüfe auf beiden Konten die aktualisierten Inventare und in **Tausch-Historie** den Status „Angenommen“.
5. Optional Ablehnen und Zurückziehen testen. Offene Angebote sollten in der passenden Eingangs-/Ausgangsliste verschwinden und in der Historie markiert sein.

## 6. Marktplatz Ende-zu-Ende testen

1. Auf Konto A eine Platte und einen Preis mindestens in Höhe des angezeigten Mindestpreises auswählen, dann **Zum Verkauf anbieten**.
2. Auf Konto B das Angebot öffnen. Der Verkäufer sollte mit seinem Markt-Spitznamen angezeigt werden.
3. Wenn B genug Coins hat, kaufen. Andernfalls erst im normalen App-Ablauf Coins verdienen.
4. Prüfe, dass A die Coins und B die Platte erhält und beide die Transaktion sehen.
5. Zusätzlich ein eigenes Angebot zurückziehen. Die reservierte Platte muss danach wieder im Inventar liegen.

## 7. Häufige Fehler

- **404 auf `market_profiles`, `friends` oder RPC:** `collection-setup.sql` fehlt oder wurde im falschen Supabase-Projekt ausgeführt. Beide SQL-Dateien oben erneut prüfen.
- **404 auf `user_profiles` oder Basistabellen:** zuerst `setup.sql` im richtigen Projekt ausführen.
- **Spitznamen, Freunde oder Angebot bleiben nach Klick unverändert:** Fehlerhinweis in der App lesen, dann Browser-Konsole und Supabase **Logs → Postgres/API** prüfen.
- **„Ihr seid keine Freunde“:** Anfrage auf der Empfängerseite noch annehmen.
- **„Platte nicht im Bestand“ / „Du hast die angefragte Platte nicht mehr“:** Das Inventar ist maßgeblich; sicherstellen, dass die angebotenen/gewünschten Platten vorhanden sind.
- **Realtime-Hinweis:** die oben genannten Tabellen in `supabase_realtime` aktivieren. Die App kann die Daten zusätzlich beim erneuten Öffnen/Laden abrufen.

## Sicherheitshinweise

- Die SQL-RPCs prüfen Nutzer, Freundschaft, Bestand, Mindestpreis und Coin-Saldo serverseitig und wickeln den jeweiligen Vorgang atomar ab.
- Nur angemeldete Nutzer können Markt-Spitznamen lesen. Schreiben kann ein Nutzer ausschließlich für die eigene, durch `auth.uid()` bestimmte ID.
- Das private `user_profiles`-Fitnessprofil wird nicht für Markt-Spitznamen verwendet.
- Niemals den Supabase `service_role`-Key im Browser oder in `.env.local` für Vite hinterlegen.
