/**
 * All game content: fictional callers, absurd schemes ("Maschen") and shop items.
 * Everything here is invented and deliberately silly. No real companies, no real methods.
 */

export interface Intel {
  id: string;
  /** What the hacker finds, shown to the team. */
  label: string;
  /** Mentioning one of these in the call gives the bonus (lowercase). */
  keywords: string[];
  bonus: number;
  /** Mentioning this intel exposes a scambaiter instead of building trust. */
  exposes?: boolean;
}

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  traits: string[];
  avatar: string;
  bg: string;
  /** Trust at the start of a call (0–100). */
  startTrust: number;
  /** How many player messages before the caller gives up. */
  patience: number;
  /** Multiplier for what the caller pays. */
  wallet: number;
  likes: string[];
  dislikes: string[];
  schemeAffinity: Record<string, number>;
  intel: Intel[];
  /** Personality notes for the AI. */
  prompt: string;
  lines: {
    greet: string[];
    up: string[];
    down: string[];
    neutral: string[];
    pay: string[];
    hangup: string[];
    timeout: string[];
  };
  baiter?: {
    realName: string;
    realTagline: string;
    revealAtTurn: number;
    revealAtTrust: number;
    penalty: number;
    reveal: string[];
    exposed: string[];
  };
}

export const PERSONAS: Persona[] = [
  {
    id: "gustav",
    name: "Gustav Grummelbart",
    tagline: "Pensionierter Leuchtturmwärter, 71 · Möwenflüsterer",
    traits: ["🧐 Misstrauisch", "🐦 Liebt Möwen", "👂 Hört schlecht"],
    avatar: "gustav",
    bg: "#7cc8ff",
    startTrust: 30,
    patience: 8,
    wallet: 1,
    likes: ["möwe", "leuchtturm", "meer", "früher", "bitte", "danke", "herr grummelbart", "toast", "seemann"],
    dislikes: ["sofort", "schnell", "dringend", "versicherung", "app", "online", "cloud"],
    schemeAffinity: { toaster: 10, fridge: 0, cloud: -10, goldfish: 5 },
    intel: [
      { id: "hamster", label: "Sein Hamster heisst «Sir Knabberton».", keywords: ["knabberton"], bonus: 15 },
      { id: "helga", label: "Seine Lieblingsmöwe heisst «Helga».", keywords: ["helga"], bonus: 12 },
    ],
    prompt:
      "Grummeliger, misstrauischer Rentner, früher Leuchtturmwärter. Hört schlecht und versteht Wörter manchmal falsch. " +
      "Liebt Möwen und seinen uralten Toaster von 1974. Hasst Hektik und alles mit 'online'. Wird weich, wenn man höflich ist und über das Meer redet.",
    lines: {
      greet: [
        "Hallo? Wer ist da? Wenn das wieder die Möwen-Versicherung ist, lege ich SOFORT auf!",
        "Grummelbart hier. Sprechen Sie laut und deutlich, junger Mensch!",
      ],
      up: [
        "Hm. Das klingt ja beinahe vernünftig. Erzählen Sie weiter.",
        "Na gut, na gut. Sie scheinen ja ein anständiger Mensch zu sein.",
        "Das erinnert mich an früher auf dem Leuchtturm. Da war auch immer alles kompliziert.",
      ],
      down: [
        "WIE BITTE? Das klingt mir aber sehr nach Seemannsgarn!",
        "Jetzt werden Sie mal nicht frech, sonst hetze ich Helga auf Sie!",
        "Hören Sie, ich bin alt, aber nicht von gestern.",
      ],
      neutral: [
        "Was? Toast? Ich habe gerade keinen Toast. Was wollen Sie denn?",
        "Moment, ich muss mein Hörgerät lauter stellen… So. Nochmal.",
      ],
      pay: ["Na schön, Sie haben mich überzeugt. Hier sind die Bro-Bucks. Aber sagen Sie es nicht den Möwen!"],
      hangup: ["Das reicht mir jetzt! Ich gehe Möwen füttern. Auf Wiederhören!"],
      timeout: ["Jetzt ist mein Tee kalt. Ich lege auf. Tschüss!"],
    },
  },
  {
    id: "kiki",
    name: "Kiki Sternschnuppe",
    tagline: "Influencerin, 24 · 3 Follower (davon 2 Bots)",
    traits: ["⚡ Ungeduldig", "📸 Will viral gehen", "💅 Leichtgläubig"],
    avatar: "kiki",
    bg: "#ffb3d1",
    startTrust: 45,
    patience: 6,
    wallet: 0.9,
    likes: ["viral", "follower", "trend", "exklusiv", "story", "likes", "glitzer", "influencer", "berühmt", "mega"],
    dislikes: ["langweilig", "formular", "warten", "später", "geduld", "kompliziert"],
    schemeAffinity: { toaster: -5, fridge: 5, cloud: 15, goldfish: 10 },
    intel: [
      { id: "cactus", label: "Ihr Kaktus «Prickelpit» hat einen eigenen Account.", keywords: ["prickelpit"], bonus: 14 },
      { id: "yacht", label: "Sie träumt von einer Glitzer-Yacht.", keywords: ["yacht"], bonus: 10 },
    ],
    prompt:
      "Überdrehte, sehr ungeduldige Influencerin mit kaum Followern. Redet in Hashtags und Superlativen, will unbedingt viral gehen. " +
      "Glaubt fast alles, was exklusiv oder trendig klingt, legt aber genervt auf, wenn es langweilig wird.",
    lines: {
      greet: ["Omg hiii! Bin grad live, also mach schnell, okay? #busy", "Kiki hier! Ist das ein Kooperationsangebot?? 😍"],
      up: ["Waaas, das ist ja MEGA! Erzähl mehr! #exklusiv", "Okay, ich bin hooked. Das wird so viral!", "Literally die beste Nachricht heute!"],
      down: ["Ähm… das klingt voll langweilig.", "Sorry, aber das gibt null Likes.", "Mein Kaktus findet das auch komisch."],
      neutral: ["Wait, was? Ich hab grad ein Selfie gemacht.", "Kannst du das nochmal in kurz sagen?"],
      pay: ["Deal! Hier sind die Bro-Bucks. Ich poste das sofort! #sponsored"],
      hangup: ["Bye, das ist mir zu cringe. *legt auf*"],
      timeout: ["Ich muss weiter, meine Story läuft ab! Byeee!"],
    },
  },
  {
    id: "balduin",
    name: "Prof. Dr. Balduin Knopf",
    tagline: "Knopfforscher, 63 · zählt alles doppelt",
    traits: ["🤓 Pedantisch", "📏 Zählt alles", "📚 Liebt Fachwörter"],
    avatar: "prof",
    bg: "#d8c7a6",
    startTrust: 25,
    patience: 9,
    wallet: 1.2,
    likes: ["wissenschaft", "studie", "prozent", "genau", "professor", "präzise", "statistik", "knopf", "forschung", "exakt"],
    dislikes: ["ungefähr", "irgendwie", "vielleicht", "lol", "krass", "egal", "halt"],
    schemeAffinity: { toaster: 0, fridge: 10, cloud: 5, goldfish: -5 },
    intel: [
      { id: "buttons", label: "Er besitzt exakt 4711 Knöpfe.", keywords: ["4711", "knopfsammlung"], bonus: 14 },
      { id: "cat", label: "Seine Katze heisst «Doktor Schnurr».", keywords: ["schnurr"], bonus: 12 },
    ],
    prompt:
      "Extrem pedantischer Professor für Knopfforschung. Korrigiert Grammatik, will Zahlen, Studien und präzise Fachwörter. " +
      "Ungenaue Aussagen und Jugendsprache machen ihn misstrauisch. Kann mit pseudowissenschaftlichem Unsinn beeindruckt werden.",
    lines: {
      greet: ["Knopf am Apparat. Professor Doktor Knopf. Bitte fassen Sie sich präzise.", "Guten Tag. Sie haben exakt 30 Sekunden."],
      up: ["Faszinierend. Das deckt sich mit meiner Forschung.", "Endlich jemand, der in ganzen Sätzen spricht.", "Interessant. Haben Sie dazu eine Studie?"],
      down: ["Das ist wissenschaftlich nicht haltbar.", "«Irgendwie»? IRGENDWIE? Wo bleibt die Präzision?", "Sie haben drei Grammatikfehler gemacht. Mindestens."],
      neutral: ["Bitte definieren Sie Ihre Begriffe.", "Ich notiere das. Fahren Sie fort."],
      pay: ["Die Daten überzeugen mich. Ich überweise exakt diese Bro-Bucks. Quittung bitte in dreifacher Ausführung."],
      hangup: ["Ich beende dieses Gespräch aus methodischen Gründen. Adieu."],
      timeout: ["Meine Sprechzeit ist um exakt 0,4 Sekunden überschritten. Auf Wiederhören."],
    },
  },
  {
    id: "wilma",
    name: "Wilma Wirbelwind",
    tagline: "Rennschnecken-Trainerin, 58 · immer in Eile",
    traits: ["🌪 Hektisch", "🐌 Rennschnecken-Fan", "😂 Lacht viel"],
    avatar: "wilma",
    bg: "#c9f2a8",
    startTrust: 40,
    patience: 7,
    wallet: 1,
    likes: ["schnecke", "rennen", "gewinnen", "sieg", "tempo", "witz", "haha", "lustig", "pokal", "champion"],
    dislikes: ["langsam", "kompliziert", "steuer", "formular", "traurig", "verlieren"],
    schemeAffinity: { toaster: 5, fridge: 10, cloud: 0, goldfish: 15 },
    intel: [
      { id: "blitz", label: "Ihre Champion-Schnecke heisst «Blitz».", keywords: ["blitz"], bonus: 14 },
      { id: "birthday", label: "Sie hat morgen Geburtstag.", keywords: ["geburtstag"], bonus: 10 },
    ],
    prompt:
      "Hektische, lustige Frau, die Rennschnecken trainiert und ständig nebenbei etwas anderes macht. Lacht laut, liebt Witze und Wettbewerbe. " +
      "Kompliziertes und Langsames nervt sie. Begeistert sich für alles mit Gewinnen und Pokalen.",
    lines: {
      greet: ["Wirbelwind! Schnell, schnell, meine Schnecken sind gerade beim Training!", "Hallo-hallo! Ich hab nur kurz Zeit, haha!"],
      up: ["HAHA! Das ist ja grossartig!", "Ein Pokal? Für mich? Erzählen Sie!", "Sie gefallen mir, Sie sind ja fast so schnell wie Blitz!"],
      down: ["Uff, das ist mir zu kompliziert.", "Das klingt so langsam wie eine Schnecke im Winterschlaf.", "Hm, da lache ich gar nicht."],
      neutral: ["Moment, eine Schnecke ist ausgebüxt… Wo waren wir?", "Ja? Ja! Was war nochmal die Frage?"],
      pay: ["Abgemacht! Hier sind die Bro-Bucks, haha! Und jetzt weiter trainieren!"],
      hangup: ["Neee, das ist nichts für mich. Tschüssi!"],
      timeout: ["Ups, das Rennen fängt an! Ich muss auflegen!"],
    },
  },
  {
    id: "bluemchen",
    name: "Herr Blümchen",
    tagline: "Behauptet, Hobby-Gärtner zu sein, 45",
    traits: ["🌷 Superfreundlich", "🪴 Liebt Dünger", "😇 Sagt zu allem Ja"],
    avatar: "agent",
    bg: "#b9e3a0",
    startTrust: 55,
    patience: 7,
    wallet: 1,
    likes: ["garten", "blume", "rose", "dünger", "tomate", "beet", "pflanze", "giessen"],
    dislikes: ["polizei", "agent"],
    schemeAffinity: { toaster: 10, fridge: 10, cloud: 10, goldfish: 10 },
    intel: [
      {
        id: "badge",
        label: "Auf dem Desktop liegt «Dienstausweis_Agent_Broesel.pdf». Er ist ein Scambaiter!",
        keywords: ["brösel", "broesel", "agent", "scambaiter", "dienstausweis"],
        bonus: 0,
        exposes: true,
      },
    ],
    prompt:
      "Verdächtig freundlicher Hobby-Gärtner, der zu allem Ja sagt. In Wahrheit ist er Agent Brösel, ein Scambaiter, der Betrüger-Callcenter hinhält. " +
      "Spiel den naiven Gärtner, stell viele Gegenfragen, verschwende Zeit, aber verrate dich nicht.",
    lines: {
      greet: ["Oh, wie schön, ein Anruf! Ich war gerade beim Tomaten-Giessen. Was kann ich für Sie tun?"],
      up: ["Ach, wie aufregend! Erzählen Sie mir ALLES. Ganz langsam bitte.", "Ja! Ja, natürlich! Und dann?", "Das klingt toll. Darf ich meine Rosen dazu holen?"],
      down: ["Oh, das verstehe ich nicht ganz. Können Sie das wiederholen? Dreimal?"],
      neutral: ["Wie schreibt man das? Mit einem oder zwei Dünger?", "Moment, ich hole einen Stift. Und einen Tee. Und meine Gartenschere."],
      pay: ["Natürlich zahle ich! Einen Moment noch…"],
      hangup: ["Oh, ich muss die Rosen giessen. Bis bald!"],
      timeout: ["Hihi. Danke für die viele Zeit, die Sie mir geschenkt haben."],
    },
    baiter: {
      realName: "Agent Brösel",
      realTagline: "Scambaiter · verschwendet Betrüger-Zeit aus Leidenschaft",
      revealAtTurn: 4,
      revealAtTrust: 85,
      penalty: 150,
      reveal: ["HAHA! Reingefallen! Ich bin Agent Brösel und habe euch die ganze Zeit hingehalten. Jetzt schlage ICH zurück!"],
      exposed: ["Mist! Enttarnt! Wie habt ihr das… Agent Brösel zieht sich zurück. *legt auf*"],
    },
  },
];

/** Sales words every caller likes a little (each counts once per call). */
export const PITCH_WORDS = ["garantiert", "exklusiv", "gratis", "geschenk", "offiziell", "zertifiziert", "experte", "sonderangebot", "nur heute", "bonus", "vip", "einmalig", "persönlich"];

export interface Scheme {
  id: string;
  title: string;
  emoji: string;
  goal: string;
  amount: number;
  keywords: string[];
  /** Needs to be bought in the shop first. */
  shop?: boolean;
}

export const SCHEMES: Scheme[] = [
  {
    id: "toaster",
    title: "Ihr Toaster hat einen Virus",
    emoji: "🍞🦠",
    goal: "«Toaster-Impfung»",
    amount: 220,
    keywords: ["toaster", "virus", "impfung", "krümel", "toast", "hustet", "fieber"],
  },
  {
    id: "fridge",
    title: "Ihr Kühlschrank hat Heimweh",
    emoji: "🧊😢",
    goal: "«Kühlschrank-Kur am Nordpol»",
    amount: 180,
    keywords: ["kühlschrank", "heimweh", "nordpol", "kur", "trösten", "traurig", "eis"],
  },
  {
    id: "cloud",
    title: "Ihre Wolke ist voll",
    emoji: "☁️",
    goal: "«Wolken-Entleerung»",
    amount: 300,
    keywords: ["wolke", "voll", "regen", "entleeren", "himmel", "speicher"],
    shop: true,
  },
  {
    id: "goldfish",
    title: "Ihr Goldfisch hat gewonnen",
    emoji: "🐠🏆",
    goal: "«Goldfisch-Gewinngebühr»",
    amount: 380,
    keywords: ["goldfisch", "gewonnen", "preis", "pokal", "aquarium", "gewinn"],
    shop: true,
  },
];

export interface ShopItem {
  id: string;
  title: string;
  text: string;
  price: number;
  art: string;
  bg: string;
  /** Unlocks this scheme when bought. */
  scheme?: string;
}

export const SHOP: ShopItem[] = [
  { id: "headset", title: "Headset Deluxe", text: "Klingt so seriös, dass jeder Anrufer mit +5 Vertrauen startet.", price: 300, art: "headset", bg: "#7cc8ff" },
  { id: "scheme_cloud", title: "Masche: «Ihre Wolke ist voll»", text: "Neue Masche! Überzeug Anrufer, dass ihre Fantasie-Wolke geleert werden muss.", price: 450, art: "cloud", bg: "#5be3b0", scheme: "cloud" },
  { id: "coffee", title: "Kaffeemaschine 3000", text: "Koffein-Turbo: +5 Sekunden in jedem Minigame.", price: 250, art: "coffee", bg: "#ffc63b" },
  { id: "scheme_goldfish", title: "Masche: «Ihr Goldfisch hat gewonnen»", text: "Der Goldfisch des Anrufers hat angeblich einen Wettbewerb gewonnen. Gebühren fallen an.", price: 600, art: "fish", bg: "#ff5d8f", scheme: "goldfish" },
  { id: "cactus", title: "Bürokaktus Kurt", text: "Beruhigt misstrauische Anrufer: Vertrauen sinkt 25 % langsamer.", price: 350, art: "cactus", bg: "#d8f0c0" },
  { id: "earmuffs", title: "Chef-Ohrenschützer", text: "Chef Bruno brüllt nur noch halb so laut. Rein kosmetisch, aber herrlich.", price: 150, art: "earmuffs", bg: "#e6dcff" },
];

export const personaById = (id: string) => PERSONAS.find((p) => p.id === id);
export const schemeById = (id: string) => SCHEMES.find((s) => s.id === id);
export const shopItemById = (id: string) => SHOP.find((s) => s.id === id);
