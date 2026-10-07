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

- `src/app/app.html`: Texte und Seitenaufbau.
- `src/app/app.css`: Farben, Layout und Geburtstagsillustration.
- `src/app/app.ts`: Interaktion des Überraschungsbuttons.
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
