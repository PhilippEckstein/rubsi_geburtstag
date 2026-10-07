# Rubsis Geburtstagsseite

Eine responsive Angular-21-Website mit automatischer Veröffentlichung über GitHub Actions.

## Lokal starten

Voraussetzung: Node.js 24 und npm.

```powershell
npm ci
npm start
```

Anschließend http://localhost:4200 öffnen.

## Inhalte ändern

- `src/app/pages/birthday.html` und `src/app/pages/wishes.html`: Texte und Seitenaufbau.
- `src/styles.css`: Farben, Seitenlayout und Geburtstagsillustration.
- `src/app/pages/birthday.ts`: Interaktion des Überraschungsbuttons.
- `src/index.html`: Seitentitel und Beschreibung.
- `public/`: Eigene Bilder und statische Dateien.

Die Texte sind ein Startentwurf; es wurden keine Geburtstagsdaten erfunden.

## GitHub Pages

Repository: https://github.com/PhilippEckstein/rubsi_geburtstag
Website nach erfolgreicher Veröffentlichung: https://philippeckstein.github.io/rubsi_geburtstag/

Einmalig im Repository unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** wählen. Bei privaten Repositories hängt die Verfügbarkeit von GitHub Pages vom GitHub-Tarif ab.

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `master` oder `main`. Er kann unter **Actions** auch manuell gestartet werden. Kein eigener `gh-pages`-Branch nötig.

```powershell
npm run build:pages
git add .
git commit -m "Update birthday website"
git push
```

Der Pages-Build verwendet `/rubsi_geburtstag/` als Basispfad. Bei Umbenennung des Repositories muss der Pfad in `package.json` angepasst werden. Das Build-Ergebnis liegt unter `dist/rubsi-geburtstag/browser`.

GitHub Pages veröffentlicht statische Dateien. Die Website braucht keinen Server und enthält keine serverseitigen Funktionen oder gespeicherten Formulare.

## Seiten und Navigation

Die App hat zwei Seiten: **Geburtstag** (`#/geburtstag`) und **Dein Geschenk** (`#/geschenk`). Die Seitennavigation zeigt die aktive Seite an. Auf kleinen Bildschirmen lässt sie sich über den Menübutton öffnen und schließen.

- `src/app/app.html` und `src/app/app.css`: App-Rahmen und Seitennavigation.
- `src/app/app.routes.ts`: Routen und Seitentitel.
- `src/app/pages/birthday.html` und `birthday.ts`: Geburtstagsseite und Überraschungsbutton.
- `src/app/pages/wishes.html`: Inhalt der Geschenkseite.
- `src/styles.css`: Gemeinsame Seitengestaltung.

Das Hash-Routing sorgt dafür, dass direkte Links und Neuladen auf GitHub Pages ohne Server-Weiterleitungen funktionieren.

## Geschenkdialog

Auf der Geburtstagsseite öffnet **Click mich für dein Geschenk** einen nativen Dialog. Sobald Mauszeiger oder Touch dem inneren Button nahekommen, weicht der gesamte Dialog flüssig innerhalb des sichtbaren Fensters aus.

Zehn Sekunden nach dem ersten Öffnen wird die Geschenkseite in der Sidenav sichtbar und der Dialogbutton anklickbar. Die Bewegung stoppt an der aktuellen Position. **Click mich** führt dann zur Geschenkseite. Schließen oder erneutes Öffnen setzt die laufende Wartezeit nicht zurück. Beim Neuladen der App beginnt das Spiel wieder mit einer gesperrten Geschenkseite.

Die Route ist vor der Freischaltung geschützt; direkte Links werden zur Geburtstagsseite umgeleitet. Die Geschenkseite enthält aktuell die bestehenden Geburtstagswünsche. Der konkrete Geschenkinhalt kann in `src/app/pages/wishes.html` ergänzt werden.

Prüfen: `npm run test:gift` und `npm run build:pages`. Die Logiktests laufen auch im GitHub-Actions-Workflow.
