# Scam with your Bros

Koop-Comedy-Browsergame für 2–8 Spieler, gebaut für [Toki](https://toki-ashy.vercel.app).
Ihr arbeitet bei **Bros Inc.**, einem absurden, komplett erfundenen Callcenter, und quatscht fiktive Anrufer
mit lächerlichen Maschen weich («Ihr Toaster hat einen Virus»). Alles ist überzeichnet und Fantasie:
keine echten Firmen, keine echten Methoden, kein Echtgeld.

![Gespräch mit einem Anrufer](client/public/shots/2.png)

## Spielablauf

1. **Raum per Code:** Ein Spieler erstellt einen Raum und bekommt einen 5-stelligen Code (ohne I, L, O, 0, 1).
   Die anderen treten nur mit diesem Code bei. Es gibt keine öffentlichen Lobbys, kein Matchmaking und keine Raumliste.
   Nur der Host startet die Schicht.
2. **Anrufe:** Fiktive Anrufer klingeln. Jeder hat eine Persönlichkeit, einen Vertrauensbalken und eine Geduld.
   Wer abnimmt, wählt eine Masche und chattet. Bei 100 % Vertrauen zahlt der Anrufer Bro-Bucks.
   Bei 0 % oder wenn die Geduld zu Ende ist, legt er auf.
3. **Fake-Hacking (Minigame):** Kollegen hacken den Comic-Desktop eines Anrufers, indem sie Codes in der richtigen
   Reihenfolge antippen (falsche Taste = −2 s). Gefundene Infos (z. B. «Hamster heisst Sir Knabberton») bringen
   im Gespräch einen Vertrauensbonus.
4. **Scambaiter:** «Herr Blümchen» ist in Wahrheit Agent Brösel. Wer ihm vertraut, verliert Bro-Bucks und
   bekommt Katzen-Pop-ups. Wer seinen Dienstausweis hackt und ihn enttarnt, bekommt einen Bonus.
5. **Tagesquote und Chef-Bewertung:** Am Ende des Tages vergibt Chef Bruno Brüllmann Sterne, Auszeichnungen und Notizen.
6. **Bro-Shop:** Das Team stimmt ab, der Host kauft Upgrades und neue Maschen. Danach folgt der nächste Tag mit höherer Quote.

**Anrufer:** Gustav Grummelbart (Leuchtturmwärter), Kiki Sternschnuppe (Influencerin), Prof. Dr. Balduin Knopf
(Knopfforscher), Wilma Wirbelwind (Rennschnecken-Trainerin) und Herr Blümchen (Scambaiter).

## Tutorial

Beim ersten Öffnen erscheint eine kurze Anleitung mit 7 Schritten: Raum per Code, Abnehmen, Vertrauen, Hacken,
Scambaiter, Quote, Chef und Shop. Sie lässt sich jederzeit mit «Überspringen» oder Esc schliessen und kommt danach
nicht mehr von selbst. Über **«❓ So geht's»** auf dem Titelscreen und in der Lobby öffnet man sie wieder
(`client/src/tutorial.ts`).

## KI-Anrufer: Skript oder eigener KI-Endpunkt

Die Anrufer antworten **per Skript** (Standard, gratis, ohne Einrichtung) **oder per KI**.

**Eigener Endpunkt im Spiel (empfohlen):** Auf dem Titelscreen oder in der Lobby auf **«🤖 KI-Anrufer»** klicken.
Dort wählt man einen Anbieter oder trägt einen **eigenen Endpunkt** ein. Jede OpenAI-kompatible
`/chat/completions`-Schnittstelle funktioniert.

| Voreinstellung | Endpunkt (änderbar) | Anmeldung |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | Bearer |
| ASK (TF Bern) | `https://ask.ict-tfbern.ch/api/v1` | Bearer |
| OpenRouter (viele Modelle, auch Claude) | `https://openrouter.ai/api/v1` | Bearer |
| Groq, Mistral, DeepSeek, Google Gemini, xAI, Together, Fireworks, Perplexity | jeweils deren OpenAI-kompatible Adresse | Bearer |
| Azure OpenAI | `https://<resource>.openai.azure.com/openai/v1` | `api-key`-Header |
| **Eigener Endpunkt** (LiteLLM, eigener OpenAI-Proxy, …) | beliebige öffentliche `https://…/v1`-Adresse | Bearer, `api-key` oder ohne Key |

Die Modellnamen in den Voreinstellungen sind nur Vorschläge, jedes Modell des Endpunkts lässt sich eintragen.

- Der Key bleibt **auf dem Gerät des Spielers**, in IndexedDB. Absichtlich nicht in `localStorage`,
  weil Toki das in die Toki-Konten synchronisiert.
- **Alle Modelle zur Auswahl:** Sobald Endpunkt und Key eingetragen sind, lädt das Fenster die Modell-Liste
  des Anbieters (`/models`, kostet nichts). Die Modelle erscheinen alle als Knöpfe und sind beim Tippen durchsuchbar,
  «📋 Modelle laden» holt sie neu. Ein gespeicherter Key wird dabei nur an dieselbe Adresse geschickt, nie an einen
  anderen Anbieter.
- **Adresse und Modell finden:** Antwortet unter der eingetragenen Adresse nichts, probiert der Server sie mit `/v1`
  am Ende noch einmal und übernimmt die Adresse, die antwortet. Der Test holt ausserdem die Modell-Liste des
  Endpunkts (`/models`), die Modelle erscheinen zum Anklicken.
- **«🔌 Verbindung testen»** prüft die Einstellung sofort, auch ohne Raum: Der Server schickt eine winzige
  Test-Anfrage und meldet Erfolg und Antwortzeit oder genau, was nicht stimmt (Key, Modell, Adresse, nicht erreichbar).
  Pro IP sind 6 Tests pro Minute möglich.
- Wer Host ist, schickt die Einstellung einmal an den Spielserver. Der prüft sie mit einer winzigen Test-Anfrage
  und nutzt sie **nur für diesen Raum, nur im Arbeitsspeicher**. Der Key wird nicht gespeichert und nicht geloggt
  und nie an Mitspieler oder zurück an Browser geschickt.
- **Schutz für den Server:** Er spricht nur `https`-Adressen an, die öffentlich sind. `localhost`, private Netze
  (10.x, 192.168.x, 172.16–31.x …), Link-local- und Cloud-Metadaten-Adressen (169.254.x) sowie interne Namen werden
  abgelehnt. Die IP wird erst beim Verbinden geprüft, damit kein DNS-Rebinding möglich ist. Weiterleitungen folgt
  der Server nicht, und Antworten sind auf 2 MB begrenzt (`server/src/netguard.ts`).
- Verlässt der Key-Besitzer den Raum, schaltet der Raum sofort auf die Skript-Anrufer zurück.
- Die Kosten gehen auf das Konto des Hosts beim Anbieter.

**Optional ein Key für alle auf dem Server** (gilt, wenn der Host keinen eigenen hat):

| Was in `.env` bzw. den Server-Einstellungen steht | Anrufer |
| --- | --- |
| nichts | Skript-Anrufer (bzw. der eigene Key des Hosts) |
| `OPENAI_API_KEY=sk-…` | OpenAI, Modell `gpt-4o-mini` (mit `LLM_MODEL` änderbar) |
| `LLM_BASE_URL=…` (+ `LLM_API_KEY`, `LLM_MODEL`, optional `LLM_AUTH=api-key` oder `none`) | eigener OpenAI-kompatibler Endpunkt, z. B. LiteLLM oder Ollama (vom Betreiber gesetzt, darf auch intern sein) |

- Fällt die KI aus oder ist das Limit erreicht, übernehmen automatisch die Skript-Anrufer. Das Spiel läuft also immer weiter.
- **Rate-Limit pro Raum:** `RATE_LIMIT_PER_MINUTE` (Standard 20) und `RATE_LIMIT_PER_ROOM` (Standard 400 KI-Antworten insgesamt).
  Zusätzlich gilt eine Pause von 1,5 s zwischen zwei Nachrichten eines Spielers.
- Der System-Prompt hält die KI in einer fiktiven, harmlosen Rolle: keine echten Firmen, Links, Daten oder Methoden.
  Jede KI-Antwort läuft zusätzlich durch denselben Filter wie der Chat.
- Oben im Spiel zeigt ein Badge, ob gerade «🤖 KI» oder «📜 Skript» aktiv ist.

## Sicherheit im Chat

Team-Chat, Nachrichten an Anrufer und KI-Antworten werden auf dem Server gefiltert
(`shared/src/safety.ts`). Entfernt werden Links und Domains, E-Mail-Adressen, lange Zahlenfolgen
(Telefon- oder Kartennummern) und alles, was nach einlösbarem Code oder Key aussieht
(z. B. `ABCD-1234-EFGH`). Namen echter Firmen und Banken werden durch «Fantasie-Firma» ersetzt.

## Lokal starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
```

```bash
cp .env.example .env
```

Optional: In `.env` den OpenAI-Key oder deinen LiteLLM-Endpunkt eintragen.

```bash
npm run dev
```

Danach <http://127.0.0.1:5173> in zwei Browserfenstern öffnen: Im einen einen Raum erstellen, im anderen mit dem Code beitreten.
Der Spielserver (Node.js) läuft lokal auf `http://127.0.0.1:8787` und liest die `.env` im Projektordner.

## Tests

```bash
npm test
```

Unit-Tests: Filter, Raumcodes, LLM-Anbindung inklusive Fallback und Rate-Limit sowie ein simulierter Spieltag.

```bash
npm run test:e2e
```

Zwei Playwright-Tests:
- **Zwei Browserfenster im selben Raum** spielen einen **kompletten Spieltag** durch: Raum per Code, falscher Code
  wird abgelehnt, Chat-Filter, Anrufe, Hacking, Quote, Chef-Bewertung, Shop und Start von Tag 2.
- **Im Toki-Rahmen:** Eine nachgebaute Toki-Seite bettet das Spiel ein wie Toki und prüft Name, «Freunde einladen»,
  Einladungslink, Raumcode-Meldung und Highscore.

## Architektur

```
client/   Vite + TypeScript, ohne Framework. Statischer Build für Toki (1280×720-Bühne, skaliert)
server/   Node.js-Server (HTTP + WebSocket mit `ws`), ein Room-Objekt pro Raumcode im Speicher
shared/   Protokoll, Spielinhalte (Anrufer, Maschen, Shop), Regeln, Filter
tests/    Vitest (unit) und Playwright (e2e)
scripts/  .env-Sync, Toki-Upload, Screenshots
toki/     Store-Texte für Toki (DE/EN)
```

**Warum ein eigener Node.js-WebSocket-Server:** Toki hostet Spiele nur statisch (`<slug>.playtoki.app`), und
Vercel-Functions können keine WebSockets offen halten. Ein Echtzeit-Server muss also separat laufen. Der Server hier
ist ein einziger Node-Prozess ohne Datenbank und ohne Anbieter-Bindung. Er hält jeden Raum im Speicher, entscheidet
alles selbst (die Clients können nicht schummeln), macht das Rate-Limit pro Raum und ist zugleich der KI-Proxy.
Er läuft lokal, per Docker auf jedem VPS oder bei Render, Railway oder Fly.io. Wichtig: **genau eine Instanz**
betreiben, weil die Räume im Speicher liegen. Für ein Partyspiel mit Raumcodes ist das genau richtig.
Colyseus wäre ein grösseres Framework für dasselbe, PartyKit läuft auf Cloudflare.

**Toki-Anbindung** (`toki-save.js`, immer die aktuelle Version von playtoki.app):
- `toki.room(code)` im Raum, `toki.room(null)` beim Verlassen → Toki zeigt «Freunde einladen».
- `toki.onHost`: Wer auf Toki «Freunde einladen» drückt, bevor ein Raum offen ist, bekommt direkt einen neuen Raum.
- `toki.onName`: Der Toki-Name steht automatisch im Namensfeld (bis man selbst etwas eintippt).
- Einladungslink `?room=CODE`: Der Code ist vorausgefüllt, ein Klick auf «Raum CODE beitreten» genügt. Beitreten geht immer nur über den Code.
- `toki.score(bucks)`: Die Bro-Bucks des Teams am Tagesende kommen auf die Toki-Rangliste (höher ist besser).
- Speichern (Name, Farbe) läuft über `localStorage`, Toki synchronisiert das selbst.

## Deployment

### 1. Spielserver

**Variante A: Render (gratis, ohne Kommandozeile)**
1. Auf [render.com](https://render.com) einloggen → **New → Blueprint** → dieses GitHub-Repository wählen.
   Render liest [`render.yaml`](render.yaml) und legt den Dienst `bros-inc-server` an.
2. `OPENAI_API_KEY` kannst du leer lassen: Jeder Host kann seinen eigenen Key im Spiel eintragen.
   Für LiteLLM stattdessen `LLM_BASE_URL`, `LLM_API_KEY` und `LLM_MODEL` setzen.
3. Nach dem Deploy steht die Adresse oben, normalerweise `https://scam-with-your-bros-server.onrender.com`.
   Das ist dieselbe Adresse wie in `.env.production`. Weicht sie ab, trägst du sie dort ein.
   Unter `/api/health` siehst du, ob die KI aktiv ist (`"ai": true`).

Der Gratis-Plan schläft nach 15 Minuten ohne Besucher ein. Das Spiel weckt ihn beim Öffnen auf und zeigt beim
ersten «Raum erstellen» einen Hinweis, falls das 30 bis 60 Sekunden dauert. Mit einem bezahlten Plan passiert das nicht.

**Variante B: Docker (eigener Server, Railway, Fly.io …)**

```bash
docker build -t bros-inc-server .
```

```bash
docker run -d -p 8787:8787 -e OPENAI_API_KEY=sk-... --name bros bros-inc-server
```

Davor gehört ein HTTPS-Proxy (z. B. Caddy oder nginx), denn Toki läuft über HTTPS und braucht deshalb `wss://`.

**Variante C: direkt mit Node.js 20+**

```bash
npm ci && npm run build:server && npm start
```

### 2. Spiel auf Toki (automatisch bei jedem Push)

Die GitHub Action [`build.yml`](.github/workflows/build.yml) läuft bei jedem Push auf `main`:
Typecheck, Unit-Tests, der Zwei-Browser-Test und der Build. Den fertigen Build (index.html + toki.json im Hauptordner)
legt sie in den Branch **`toki-build`**. Bei Pull Requests wird nur getestet und gebaut.

1. Auf Toki **Spiel hinzufügen → Von GitHub** wählen, dieses Repository und den Branch **`toki-build`** auswählen
   (Ordner leer lassen).
2. Fertig: Toki übernimmt jeden neuen Build aus `toki-build` automatisch. Du arbeitest normal auf `main`.

Alle Angaben für den Eintrag stehen in [`toki.json`](toki.json) im Hauptordner: Titel, Beschreibung DE/EN,
Steuerung, Kategorie, Cover, Screenshots, Multiplayer (max. 8), Highscore und Version. `folder: dist` sagt Toki,
wo der Build liegt. Für ein Update erhöhst du `version`, schreibst `notes` und pushst: Toki postet dann ein Update für die Spieler.

Die Adresse des Spielservers steht in [`.env.production`](.env.production) (`VITE_SERVER_URL`, kein Geheimnis).
Wenn Render deinem Dienst eine andere Adresse gibt oder der Server woanders läuft, änderst du sie dort und pushst.

Von Hand hochladen geht auch (Key unter **Meine Spiele → Upload keys**):

```bash
TOKI_KEY=toki_... npm run toki:upload
```

### Screenshots neu machen

Mit laufendem `npm run dev`:

```bash
node scripts/screenshots.mjs
```

## Später

- Sprache (Text-to-Speech geht im Toki-iframe; für Spracheingabe müsste Toki dem iframe `microphone` erlauben)
- Englische Spieloberfläche (die KI antwortet schon in der Sprache des Spielers)
- Mehr Anrufer, Maschen und Minigames
