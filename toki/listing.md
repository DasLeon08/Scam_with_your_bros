# Toki-Eintrag: Scam with your Bros · Version 1.0

Diese Angaben stehen auch maschinenlesbar in `toki.json` (Hauptordner) und werden beim Upload übernommen.

| Feld | Wert |
| --- | --- |
| Titel | Scam with your Bros |
| Slug / Adresse | `scam-with-your-bros` → `/game/scam-with-your-bros`, Spiel unter `https://scam-with-your-bros.playtoki.app/` |
| Kategorie | `other`. Toki hat keine Kategorie «Mehrspieler»; Mehrspieler ist das Flag `multiplayer: true`, das als Badge erscheint |
| Mehrspieler | ja, Räume per Code, `max_players: 8`, Einladungs-Parameter `room` |
| Highscore | Bro-Bucks des Teams pro Tag, höher ist besser |
| Engine | HTML/TypeScript (Vite) |
| Version | 1.0 «Erste Schicht bei Bros Inc.» |
| Cover | `client/public/cover.png` (1280×720) |
| Screenshots | `client/public/shots/1.png` bis `4.png`: Lobby, Gespräch, Fake-Hacking, Chef-Bewertung |

## Beschreibung (Deutsch)

Koop-Comedy-Spiel für 2–8 Spieler. Ihr arbeitet bei Bros Inc., dem absurdesten (und komplett erfundenen)
Callcenter der Welt. Fiktive KI-Anrufer mit eigener Persönlichkeit und Vertrauensbalken rufen an.
Überzeugt sie mit den lächerlichsten Geschichten («Ihr Toaster hat einen Virus!»), hackt im Team ihren
Comic-Desktop für nützliche Infos, passt auf den Scambaiter auf, der zurückschlägt, knackt die Tagesquote
und übersteht die Chef-Bewertung. Danach geht's mit den Bro-Bucks in den Shop.
Räume sind privat: Erstelle einen und teile den 5-stelligen Code.

## Description (English)

A co-op comedy game for 2–8 players. You work at Bros Inc., the most absurd (and completely fictional)
call center in the world. Fictional AI callers phone in with their own personalities and a trust bar.
Talk them into the silliest stories ("Your toaster has a virus!"), hack their cartoon desktop as a team to dig up
useful intel, watch out for the scambaiter who strikes back, hit the daily quota and survive the boss's review.
Then spend your Bro-Bucks in the shop. Rooms are private: create one and share the 5-character code.

## Steuerung

- **DE:** Maus/Touch: Anrufe annehmen, Masche wählen, hacken (Codes der Reihe nach antippen). Tastatur: Text eintippen, Enter sendet. Beitritt nur mit Raumcode.
- **EN:** Mouse/touch: pick up calls, choose a scheme, hack (tap the codes in order). Keyboard: type your pitch and press Enter. Join with a room code only.

## Update-Notizen 1.0

- Private Räume mit 5-stelligem Code für 2 bis 8 Spieler
- 5 fiktive Anrufer mit Vertrauensbalken, darunter ein Scambaiter
- Minigame «Fake-Hacking» für Team-Infos
- Tagesquote, Chef-Bewertung und Bro-Shop

## Hinweise für die Prüfung

- Alle Anrufer, Firmen und Maschen sind erfunden und überzeichnet; es gibt kein Echtgeld (nur «Bro-Bucks»).
- Chat und KI-Antworten werden serverseitig gefiltert: keine Links, E-Mails, Nummern oder einlösbaren Codes.
- Kein Matchmaking und keine öffentlichen Lobbys; «Invite friends» auf Toki teilt nur den Raumcode.
