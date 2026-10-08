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

Die Route ist vor der Freischaltung geschützt; direkte Links werden zur Geburtstagsseite umgeleitet. Die Geschenkseite zeigt das bereitgestellte Lama-Foto und einen weiteren Geschenkbutton. Der Inhalt kann in `src/app/pages/wishes.html` geändert werden; die Originalfotos liegen unter `public/images/`.

Prüfen: `npm run test:gift` und `npm run build:pages`. Die Logiktests laufen auch im GitHub-Actions-Workflow.

## Meme-Bild

Erstellt mit dem integrierten Imagegen-Tool. Motiv/Prompt: Peter Griffin sitzt erschöpft und genervt mit einer Computermaus auf seinem Sofa im Family-Guy-Zeichenstil. Quadratisches Meme mit großer weißer Schrift und schwarzer Kontur. Oberer Text: "ICH NACH 10 SEKUNDEN BUTTON-JAGD". Unterer Text: "WO IST MEIN GESCHENK?". Keine weiteren Figuren oder Wasserzeichen.

## Lama-Geschenk und Hardstyle-Streich

Die zweite Seite zeigt `public/images/lama-geschenk.png`. **Hier kommt dein Geschenk** öffnet gleichzeitig fünf übereinanderliegende native Dialoge mit `public/images/garden-prank.png` und dem Text **Hahah du bist so ein Idiot**. Beide Bilder wurden unverändert aus den bereitgestellten Anhängen übernommen.

Die Dialoge lassen sich einzeln über das Kreuz oder Escape schließen. Der Button **Hardstyle beenden** befindet sich auf der Seite hinter den Dialogen. Er ist durch die modalen Dialoge verdeckt und bleibt zusätzlich deaktiviert, bis alle fünf geschlossen wurden. Das Schließen des letzten Dialogs beendet die Musik noch nicht; erst der Stop-Button beendet den Loop. Danach kann der Streich erneut gestartet werden.

`src/app/pages/hardstyle-player.ts` erzeugt lokal einen Loop mit 320 BPM, stark verzerrten Kicks, Kick-Rolls, Offbeat-Bass und einem schnellen verstimmten Hardstyle-Synth. Der Start läuft direkt im Geschenk-Klick über die Web Audio API. Es gibt keinen YouTube-Player und keine externen Musik-Anfragen. Die Dialoge öffnen sich nach erfolgreichem Audio-Start. Bei Verlassen der Seite werden Musik und Dialoge beendet.

`npm run test:gift` prüft sowohl die zehn Sekunden Wartezeit auf Seite eins als auch die fünf Dialoge, den Stop-Button und die Audio-Aufräumlogik.

## Drachenlord-Meme

Auf der zweiten Seite steht unter dem Lama-Foto zusätzlich ein mit dem integrierten Imagegen-Tool erstelltes Meme: `public/memes/drachenlord-hardstyle.png`.

Motiv/Prompt: Drachenlord als überraschte Comicfigur, die auf eine Geburtstagswebsite mit sehr schnellem Hardstyle reagiert. Große weiße Meme-Schrift mit schwarzer Kontur. Oberer Text: "ICH: NUR KURZ DAS GESCHENK ÖFFNEN". Unterer Text: "DIE WEBSITE: 320 BPM HARDSTYLE". Quadratisches Bild mit Lautsprechern im Hintergrund.
