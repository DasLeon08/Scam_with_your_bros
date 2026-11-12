import * as art from "./art";

/** The short, skippable "So geht's" tour. */
export interface TutorialStep {
  title: string;
  text: string;
  art: string;
  bg: string;
}

const big = (s: string) => s.replace(/width="\d+" height="\d+"/, 'width="150" height="150"');

export const TUTORIAL: TutorialStep[] = [
  {
    title: "Willkommen bei Bros Inc.!",
    text: "Ihr arbeitet zusammen im absurdesten Callcenter der Welt. Fiktive Anrufer melden sich, und ihr überzeugt sie mit den lächerlichsten Geschichten. Alles ist erfunden, Geld gibt es nur als Fantasie-«Bro-Bucks».",
    art: big(art.bro("#ffc63b", "cap")),
    bg: "#ffc63b",
  },
  {
    title: "1 · Raum per Code",
    text: "Einer klickt «Raum erstellen» und bekommt einen 5-stelligen Code. Die anderen treten mit diesem Code bei (2 bis 8 Bros). Auf Toki geht das auch über «Freunde einladen». Der Host startet die Schicht.",
    art: `<div class="tut-code">K7QX2</div>`,
    bg: "#7cc8ff",
  },
  {
    title: "2 · Abnehmen und Masche wählen",
    text: "Klingelt ein Telefon, nimmst du ab und wählst eine Masche, zum Beispiel «Ihr Toaster hat einen Virus». Dann schreibst du dem Anrufer im Chat. Jede Nachricht verändert seinen Vertrauensbalken.",
    art: big(art.caller("gustav", 150)),
    bg: "#5be3b0",
  },
  {
    title: "3 · Vertrauen aufbauen",
    text: "Bei 100 % zahlt der Anrufer Bro-Bucks, bei 0 % legt er auf, und seine Geduld ist begrenzt. Sprich über das, was er mag, und wiederhol dich nicht. Die Vorschläge 💡 💛 ✨ über dem Eingabefeld helfen.",
    art: `<div class="tut-bar"><i></i><span>Vertrauen 82 %</span></div>`,
    bg: "#ff9a3c",
  },
  {
    title: "4 · Im Team hacken",
    text: "Wer gerade nicht telefoniert, hackt den Comic-PC des Anrufers: Tippe die Codes in der richtigen Reihenfolge an (falsche Taste = −2 s). Gefundene Infos erscheinen beim Gespräch. Wer sie erwähnt, bekommt viel Vertrauen.",
    art: `<div class="tut-hex"><b>B4</b><b>7E</b><b class="on">1F</b><b>C0</b><b>FF</b><b>4C</b></div>`,
    bg: "#9b7bff",
  },
  {
    title: "5 · Vorsicht, Scambaiter!",
    text: "«Herr Blümchen» ist verdächtig nett: In Wahrheit ist er Agent Brösel und schlägt zurück. Wer seinen PC hackt, findet seinen Dienstausweis. Sprich ihn darauf an, und er ist enttarnt.",
    art: big(art.caller("agent", 150, true)),
    bg: "#ff5d8f",
  },
  {
    title: "6 · Quote, Chef und Shop",
    text: "Knackt die Tagesquote! Am Feierabend bewertet Chef Bruno euren Tag mit Sternen. Danach kauft ihr im Bro-Shop gemeinsam Upgrades und neue Maschen. Viel Spass!",
    art: big(art.boss(150)),
    bg: "#ffc63b",
  },
];

export const TUTORIAL_KEY = "bros.tutorial.done";

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return true; // no storage: don't nag every time
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1");
  } catch {}
}
