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

## KI-Anrufer: Skript oder OpenAI

Die Anrufer antworten **entweder per Skript** (ohne Konfiguration, kostet nichts) **oder per KI**.
Die Einstellung steht nur in der `.env` bzw. in den Server-Secrets. **Der Key kommt nie in den Browser:**
Alle Anfragen laufen über den Spielserver.

| Was in `.env` steht | Anrufer |
| --- | --- |
| nichts | Skript-Anrufer |
| `OPENAI_API_KEY=sk-…` | OpenAI, Modell `gpt-4o-mini` (mit `LLM_MODEL` änderbar) |
| `LLM_BASE_URL=…` (+ `LLM_API_KEY`, `LLM_MODEL`) | eigener OpenAI-kompatibler Endpunkt, z. B. LiteLLM oder Ollama |

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

Ein Playwright-Test öffnet **zwei Browserfenster im selben Raum** und spielt einen **kompletten Spieltag** durch:
Raum per Code, falscher Code wird abgelehnt, Chat-Filter, Anrufe, Hacking, Quote, Chef-Bewertung, Shop und Start von Tag 2.

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

**Toki-Anbindung:** `toki-save.js` ist eingebunden. Im Raum ruft das Spiel `toki.room(code)` auf, dann bietet
Toki «Invite friends» an. Eine Einladung öffnet das Spiel mit `?room=CODE`. Das füllt **nur das Code-Feld vor**,
beitreten muss man trotzdem selbst über den Code.

## Deployment

### 1. Spielserver

**Variante A: Render (gratis, ohne Kommandozeile)**
1. Auf [render.com](https://render.com) einloggen → **New → Blueprint** → dieses GitHub-Repository wählen.
   Render liest [`render.yaml`](render.yaml) und legt den Dienst `bros-inc-server` an.
2. Bei `OPENAI_API_KEY` deinen OpenAI-Key eintragen (oder leer lassen für Skript-Anrufer).
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

1. Auf Toki **Spiel hinzufügen → Von GitHub** wählen, dieses Repository und den Branch **`main`** auswählen.
2. Toki meldet «Quellcode, aber kein Build». Dann **«GitHub Action einrichten»** klicken und den Pull Request
   von Toki Connect mergen (er legt `.github/workflows/toki.yml` an und braucht keinen Key).
3. Ab dann baut GitHub bei jedem Push auf `main` das Spiel (`npm ci` und `npm run build` → `dist/`) und stellt es auf Toki.

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
