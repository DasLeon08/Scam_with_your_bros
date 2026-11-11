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
Der Spielserver läuft lokal auf `http://127.0.0.1:8787` (Wrangler, also dieselbe Laufzeit wie später bei Cloudflare).

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
server/   Cloudflare Worker + Durable Object «Room», ein Objekt pro Raumcode
shared/   Protokoll, Spielinhalte (Anrufer, Maschen, Shop), Regeln, Filter
tests/    Vitest (unit) und Playwright (e2e)
scripts/  .env-Sync, Toki-Upload, Screenshots
toki/     Store-Texte für Toki (DE/EN)
```

**Warum Cloudflare Durable Objects:** Toki hostet Spiele statisch (R2, `<slug>.playtoki.app`), und Vercel-Functions
können keine WebSockets offen halten. Ein Durable Object pro Raumcode ist ein kleiner Server pro Runde:
Er hält den Spielzustand, entscheidet alles selbst (die Clients können nicht schummeln), macht das Rate-Limit
pro Raum und ist zugleich der KI-Proxy. Es gibt keinen eigenen Server zu betreiben, und der Gratis-Plan reicht.
Apex auf Toki nutzt dasselbe Muster (Worker-Relay mit Raumcode).

**Toki-Anbindung:** `toki-save.js` ist eingebunden. Im Raum ruft das Spiel `toki.room(code)` auf, dann bietet
Toki «Invite friends» an. Eine Einladung öffnet das Spiel mit `?room=CODE`. Das füllt **nur das Code-Feld vor**,
beitreten muss man trotzdem selbst über den Code.

## Deployment

### 1. Spielserver (Cloudflare)

```bash
cd server && npx wrangler login
```

```bash
cd server && npx wrangler deploy
```

Für KI-Anrufer den Key als Secret setzen (nicht in `wrangler.toml`):

```bash
cd server && npx wrangler secret put OPENAI_API_KEY
```

Für LiteLLM stattdessen `LLM_BASE_URL`, `LLM_API_KEY` und `LLM_MODEL` als Secrets setzen. Die erlaubten Seiten
(`ALLOWED_ORIGINS`) stehen in `server/wrangler.toml`.

### 2. Spiel auf Toki hochladen

Auf Toki unter **My games → Upload keys** einen Key erstellen, dann:

```bash
TOKI_KEY=toki_... VITE_SERVER_URL=https://bros-inc-server.<dein-name>.workers.dev npm run toki:upload
```

Das baut den Client und lädt `client/dist` mit Toki's offiziellem Uploader hoch. Titel, Beschreibung DE/EN,
Steuerung, Kategorie, Cover, Screenshots, Multiplayer (max. 8) und Version kommen aus
[`client/public/toki.json`](client/public/toki.json).
Für ein Update erhöhst du `version` und schreibst `notes`: Toki postet dann automatisch ein Update für die Spieler.
Mit `-- --dry-run` siehst du vorher, was hochgeladen würde.

Automatisch geht es auch: `.github/workflows/toki.yml` lädt bei jedem Push auf `main` hoch.
Dafür braucht das Repository das Secret `TOKI_KEY` und die Variable `VITE_SERVER_URL`.

### Screenshots neu machen

Mit laufendem `npm run dev`:

```bash
node scripts/screenshots.mjs
```

## Später

- Sprache (Text-to-Speech geht im Toki-iframe; für Spracheingabe müsste Toki dem iframe `microphone` erlauben)
- Englische Spieloberfläche (die KI antwortet schon in der Sprache des Spielers)
- Mehr Anrufer, Maschen und Minigames
