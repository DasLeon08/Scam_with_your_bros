/** All game art: original SVG figures drawn in code. */
const INK = "#1b1530";
const S = (w: number, inner: string, vb = "0 0 100 100") =>
  `<svg viewBox="${vb}" width="${w}" height="${w}" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;

export function bro(color: string, hair: string, w = 100): string {
  const hairs: Record<string, string> = {
    cap: `<path d="M24 40 Q26 16 50 15 Q74 16 76 40 Z" fill="${INK}"/><path d="M50 15 Q74 16 76 40 L90 42 Q92 36 80 33" fill="${INK}"/><circle cx="50" cy="16" r="3" fill="#fff"/>`,
    bun: `<path d="M24 44 Q22 18 50 18 Q78 18 76 44 Q66 30 50 30 Q34 30 24 44Z" fill="#6b3b2a"/><circle cx="50" cy="12" r="10" fill="#6b3b2a"/>`,
    glasses: `<path d="M26 40 Q30 18 50 19 Q70 18 74 40 Q62 28 50 30 Q38 28 26 40Z" fill="#e8b04a"/><circle cx="40" cy="50" r="8" fill="none"/><circle cx="60" cy="50" r="8" fill="none"/><path d="M48 50 L52 50" />`,
    none: `<path d="M27 38 Q32 20 50 20 Q68 20 73 38" fill="none" stroke-width="5"/>`,
  };
  const r = hair === "glasses" ? 2.5 : 3.5;
  return S(
    w,
    `<path d="M14 100 Q16 76 50 74 Q84 76 86 100Z" fill="${color}"/>
    <path d="M42 74 L50 86 L58 74" fill="#fff"/>
    <circle cx="50" cy="46" r="26" fill="#ffd9b0"/>
    ${hairs[hair] ?? ""}
    <circle cx="40" cy="50" r="${r}" fill="${INK}" stroke="none"/><circle cx="60" cy="50" r="${r}" fill="${INK}" stroke="none"/>
    <path d="M40 60 Q50 68 60 60" fill="none"/>
    <circle cx="33" cy="57" r="3" fill="#ff9aa8" stroke="none"/><circle cx="67" cy="57" r="3" fill="#ff9aa8" stroke="none"/>
    <path d="M22 46 Q22 22 50 21 Q78 22 78 46" fill="none" stroke-width="4"/>
    <rect x="16" y="42" width="10" height="16" rx="4" fill="${color}"/>
    <path d="M21 58 Q24 68 38 66" fill="none"/><circle cx="39" cy="66" r="3" fill="${INK}"/>`,
  );
}

const gustav = (w: number) =>
  S(w, `<path d="M10 100 Q14 74 50 72 Q86 74 90 100Z" fill="#2d5d9f"/>
  <path d="M30 80 L70 80" stroke="#fff" stroke-width="4"/><path d="M26 90 L74 90" stroke="#fff" stroke-width="4"/>
  <circle cx="50" cy="46" r="25" fill="#f2c9a0"/>
  <path d="M26 52 Q28 82 50 84 Q72 82 74 52 Q66 62 50 62 Q34 62 26 52Z" fill="#e9e6df"/>
  <path d="M40 62 Q50 58 60 62" fill="none"/>
  <path d="M34 42 L44 44 M66 42 L56 44" stroke-width="4"/>
  <circle cx="40" cy="49" r="2.8" fill="${INK}" stroke="none"/><circle cx="60" cy="49" r="2.8" fill="${INK}" stroke="none"/>
  <path d="M47 50 Q50 58 53 50" fill="#e9a982"/>
  <path d="M22 34 L78 34 L74 22 Q50 12 26 22Z" fill="#1c2f55"/><rect x="20" y="32" width="60" height="7" rx="3" fill="#13203d"/>
  <path d="M44 24 L50 19 L56 24 L50 29Z" fill="#ffc63b"/>`);

const kiki = (w: number) =>
  S(w, `<path d="M12 100 Q16 76 50 74 Q84 76 88 100Z" fill="#ff5d8f"/>
  <circle cx="50" cy="46" r="25" fill="#ffd2b8"/>
  <path d="M24 46 Q20 18 50 18 Q80 18 76 46 Q72 30 50 30 Q28 30 24 46Z" fill="#ff8ac6"/>
  <circle cx="50" cy="12" r="11" fill="#ff8ac6"/>
  <rect x="29" y="42" width="18" height="12" rx="6" fill="#1b1530"/><rect x="53" y="42" width="18" height="12" rx="6" fill="#1b1530"/><path d="M47 47 L53 47"/>
  <path d="M42 62 Q50 70 58 62" fill="#ff4d6d"/>
  <path d="M78 64 l6 -6 l2 8z" fill="#ffc63b"/>`);

const prof = (w: number) =>
  S(w, `<path d="M12 100 Q16 76 50 74 Q84 76 88 100Z" fill="#8a6a4a"/>
  <path d="M44 74 L50 92 L56 74" fill="#c33"/>
  <circle cx="50" cy="46" r="25" fill="#f4d3b0"/>
  <path d="M25 44 Q22 30 30 28 M75 44 Q78 30 70 28" stroke="#ccc" stroke-width="6" fill="none"/>
  <circle cx="60" cy="48" r="8" fill="none" stroke-width="3"/><path d="M68 50 Q74 64 70 76" fill="none" stroke-width="1.5"/>
  <circle cx="40" cy="48" r="2.5" fill="${INK}" stroke="none"/><circle cx="60" cy="48" r="2.5" fill="${INK}" stroke="none"/>
  <path d="M40 64 L60 62" fill="none"/>
  <path d="M34 40 L46 38 M54 38 L66 40"/>`);

const wilma = (w: number) =>
  S(w, `<path d="M12 100 Q16 76 50 74 Q84 76 88 100Z" fill="#5bbf6a"/>
  <circle cx="50" cy="46" r="25" fill="#ffd9b8"/>
  <path d="M22 50 Q14 20 40 16 Q50 6 62 14 Q88 18 78 50 Q76 30 62 28 Q50 34 36 28 Q24 32 22 50Z" fill="#ff9a3c"/>
  <path d="M18 34 l-8 -4 M20 24 l-8 -8 M82 34 l8 -4 M80 24 l8 -8" stroke-width="2.5"/>
  <circle cx="40" cy="48" r="3.5" fill="${INK}" stroke="none"/><circle cx="60" cy="48" r="3.5" fill="${INK}" stroke="none"/>
  <path d="M38 58 Q50 72 62 58 Z" fill="#fff"/>
  <g transform="translate(70,80)"><circle cx="8" cy="6" r="7" fill="#e8b04a"/><path d="M0 12 Q10 14 20 10" fill="none"/><path d="M14 2 l2 -6 M17 3 l4 -4" stroke-width="2"/></g>`);

const agent = (w: number, reveal = false) =>
  S(w, `<path d="M10 100 Q14 74 50 72 Q86 74 90 100Z" fill="${reveal ? "#7a6a4a" : "#6aa84f"}"/>
  <path d="M40 72 L50 100 L60 72" fill="#ddd"/><path d="M48 76 L52 76 L54 96 L50 100 L46 96Z" fill="${reveal ? "#ff4d4d" : "#ffc63b"}"/>
  <circle cx="50" cy="48" r="24" fill="#f0c9a0"/>
  ${reveal
    ? `<path d="M16 36 L84 36 L76 30 Q74 12 50 12 Q26 12 24 30Z" fill="#5a4a30"/><rect x="24" y="28" width="52" height="6" fill="#2a2018"/>
       <rect x="28" y="42" width="44" height="12" rx="4" fill="#111"/><path d="M50 44 L50 52" stroke="#555"/><path d="M38 62 Q50 72 62 62" fill="#fff"/>`
    : `<path d="M18 36 Q20 14 50 14 Q80 14 82 36 Q66 26 50 28 Q34 26 18 36Z" fill="#e9d36a"/><circle cx="78" cy="22" r="7" fill="#ff8ac6"/><circle cx="78" cy="22" r="2.5" fill="#ffc63b" stroke="none"/>
       <circle cx="40" cy="49" r="2.8" fill="${INK}" stroke="none"/><circle cx="60" cy="49" r="2.8" fill="${INK}" stroke="none"/><path d="M40 60 Q50 68 60 60" fill="none"/>`}
  ${reveal ? `<path d="M34 56 Q42 60 50 56 Q58 60 66 56" fill="#5a4a30" stroke-width="2"/>` : ""}`);

const unknown = (w: number) =>
  S(w, `<path d="M12 100 Q16 76 50 74 Q84 76 88 100Z" fill="#4a4560"/>
  <circle cx="50" cy="46" r="25" fill="#3a3550"/>
  <text x="50" y="58" font-family="Lilita" font-size="34" text-anchor="middle" fill="#ffc63b" stroke="none">?</text>`);

export function caller(avatar: string, w: number, reveal = false): string {
  switch (avatar) {
    case "gustav": return gustav(w);
    case "kiki": return kiki(w);
    case "prof": return prof(w);
    case "wilma": return wilma(w);
    case "agent": return agent(w, reveal);
    default: return unknown(w);
  }
}

export const boss = (w = 64) =>
  S(w, `<path d="M6 100 Q10 70 50 68 Q90 70 94 100Z" fill="#3b3b4f"/>
  <path d="M40 68 L50 80 L60 68" fill="#fff"/><path d="M47 74 L53 74 L56 98 L50 100 L44 98Z" fill="#ffc63b"/>
  <circle cx="50" cy="42" r="26" fill="#ffc9a0"/>
  <path d="M24 34 Q26 14 50 14 Q74 14 76 34 Q70 24 50 26 Q30 24 24 34Z" fill="#222"/>
  <path d="M33 36 L45 40 M67 36 L55 40" stroke-width="5"/>
  <circle cx="41" cy="45" r="3" fill="${INK}" stroke="none"/><circle cx="59" cy="45" r="3" fill="${INK}" stroke="none"/>
  <path d="M28 56 Q38 48 50 54 Q62 48 72 56 Q62 62 50 58 Q38 62 28 56Z" fill="#222"/>
  <ellipse cx="50" cy="64" rx="8" ry="5" fill="#8c1c2e"/>`);

export const bossBig = () =>
  S(420, `<g transform="translate(0,6)">
  <path d="M6 100 Q10 70 50 68 Q90 70 94 100Z" fill="#3b3b4f"/>
  <path d="M40 68 L50 80 L60 68" fill="#fff"/><path d="M47 74 L53 74 L56 98 L50 100 L44 98Z" fill="#ffc63b"/>
  <circle cx="50" cy="42" r="26" fill="#ffc9a0"/>
  <path d="M24 34 Q26 14 50 14 Q74 14 76 34 Q70 24 50 26 Q30 24 24 34Z" fill="#222"/>
  <path d="M33 36 L45 40 M67 36 L55 40" stroke-width="4"/>
  <circle cx="41" cy="45" r="3" fill="${INK}" stroke="none"/><circle cx="59" cy="45" r="3" fill="${INK}" stroke="none"/>
  <path d="M28 56 Q38 48 50 54 Q62 48 72 56 Q62 62 50 58 Q38 62 28 56Z" fill="#222"/>
  <ellipse cx="50" cy="63" rx="7" ry="4" fill="#8c1c2e"/>
  <g transform="translate(70,58) rotate(-20)"><path d="M0 4 L10 0 L26 -8 L26 22 L10 14 L0 10Z" fill="#ff5d8f"/><rect x="-6" y="3" width="8" height="8" rx="2" fill="#ddd"/></g>
  </g>`);

export const crown = () => S(44, `<path d="M8 30 L12 10 L22 22 L30 6 L38 22 L48 10 L52 30Z" fill="#ffc63b" transform="scale(.7) translate(2,6)"/>`, "0 0 40 30");
export const star = (on: boolean) => S(54, `<path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36Z" fill="${on ? "#ffc63b" : "#fff"}" stroke-width="5"/>`);

export const building = () => `<svg width="408" height="170" viewBox="0 0 480 200" stroke="${INK}" stroke-width="3" stroke-linejoin="round" aria-hidden="true">
  <rect x="40" y="40" width="250" height="160" fill="#fff4dc"/>
  <rect x="40" y="40" width="250" height="26" fill="#ff5d8f"/>
  <text x="165" y="60" font-family="Lilita" font-size="20" text-anchor="middle" fill="#fff" stroke="none">BROS INC.</text>
  ${[0, 1, 2, 3, 4].map((c) => [0, 1, 2].map((r) => `<rect x="${58 + c * 46}" y="${80 + r * 38}" width="30" height="24" fill="${(c + r) % 3 ? "#7cc8ff" : "#ffc63b"}"/>`).join("")).join("")}
  <rect x="300" y="90" width="110" height="110" fill="#ffe9bd"/>
  ${[0, 1].map((c) => [0, 1].map((r) => `<rect x="${316 + c * 46}" y="${106 + r * 40}" width="30" height="24" fill="#7cc8ff"/>`).join("")).join("")}
  <path d="M150 40 L150 10 M150 10 l18 6 l-18 6" fill="#ffc63b"/>
  <circle cx="360" cy="60" r="18" fill="#ffc63b"/><path d="M350 58 q10 -10 20 0" fill="none"/>
</svg>`;

export const item: Record<string, string> = {
  headset: S(86, `<path d="M22 60 Q22 20 50 20 Q78 20 78 60" fill="none" stroke-width="7"/><rect x="14" y="52" width="18" height="28" rx="7" fill="#ffc63b"/><rect x="68" y="52" width="18" height="28" rx="7" fill="#ffc63b"/><path d="M23 80 Q30 92 46 90" fill="none"/><circle cx="48" cy="90" r="5" fill="${INK}"/><path d="M40 12 l4 6 M60 12 l-4 6 M50 8 v8" stroke-width="3"/>`),
  cloud: S(86, `<path d="M26 70 Q10 70 12 56 Q14 42 30 44 Q34 26 52 28 Q70 28 72 44 Q90 42 90 58 Q88 72 72 70Z" fill="#fff"/><circle cx="40" cy="54" r="3" fill="${INK}"/><circle cx="62" cy="54" r="3" fill="${INK}"/><path d="M44 62 Q51 58 58 62" fill="none"/><path d="M30 78 l-4 10 M50 78 l-2 12 M70 78 l-4 10" stroke="#2a7bd0"/>`),
  coffee: S(86, `<rect x="24" y="14" width="52" height="70" rx="6" fill="#ff5d8f"/><rect x="32" y="22" width="36" height="16" rx="3" fill="#7cc8ff"/><text x="50" y="35" font-size="11" font-family="Lilita" text-anchor="middle" stroke="none" fill="${INK}">3000</text><rect x="38" y="50" width="24" height="24" fill="#fff"/><path d="M44 50 v-6 M56 50 v-6" /><rect x="20" y="84" width="60" height="8" fill="${INK}"/>`),
  fish: S(86, `<circle cx="50" cy="56" r="34" fill="#cdeeff" opacity=".9"/><path d="M30 56 Q46 38 62 56 Q46 74 30 56Z" fill="#ff9a3c"/><path d="M62 56 L76 46 L76 66Z" fill="#ff9a3c"/><circle cx="40" cy="53" r="2.5" fill="${INK}"/><path d="M46 18 L54 18 L56 30 L44 30Z" fill="#ffc63b"/><path d="M42 30 L58 30" />`),
  cactus: S(86, `<path d="M42 80 L42 30 Q42 18 50 18 Q58 18 58 30 L58 80" fill="#5bbf6a"/><path d="M42 56 L32 56 Q26 56 26 48 L26 40" fill="none" stroke-width="7" stroke="#5bbf6a"/><path d="M42 56 L32 56 Q26 56 26 48 L26 40" fill="none"/><circle cx="46" cy="36" r="2" fill="${INK}"/><circle cx="54" cy="36" r="2" fill="${INK}"/><path d="M46 44 Q50 48 54 44" fill="none"/><path d="M30 80 L70 80 L64 96 L36 96Z" fill="#d0743c"/>`),
  earmuffs: S(86, `<path d="M24 60 Q24 22 50 22 Q76 22 76 60" fill="none" stroke-width="6"/><circle cx="24" cy="62" r="14" fill="#ff8ac6"/><circle cx="76" cy="62" r="14" fill="#ff8ac6"/><path d="M40 86 l20 0" /><text x="50" y="98" font-size="10" text-anchor="middle" font-family="Lilita" fill="${INK}" stroke="none">psst</text>`),
  vending: S(60, `<rect x="18" y="8" width="64" height="86" rx="6" fill="#ff5d8f"/><rect x="26" y="16" width="34" height="56" fill="#7cc8ff"/><circle cx="34" cy="28" r="4" fill="#ffc63b"/><circle cx="50" cy="28" r="4" fill="#5be3b0"/><circle cx="34" cy="44" r="4" fill="#fff"/><circle cx="50" cy="44" r="4" fill="#ffc63b"/><rect x="66" y="20" width="10" height="20" fill="#fff"/><rect x="26" y="78" width="48" height="8" fill="${INK}"/>`),
};

export const phone = (w = 60) =>
  S(w, `<path d="M20 70 Q16 40 50 38 Q84 40 80 70 Z" fill="#ff5d8f"/><rect x="14" y="70" width="72" height="16" rx="6" fill="#ff5d8f"/><path d="M26 30 Q50 14 74 30" fill="none" stroke-width="6"/><rect x="18" y="22" width="16" height="14" rx="5" fill="#fff4dc"/><rect x="66" y="22" width="16" height="14" rx="5" fill="#fff4dc"/><circle cx="50" cy="58" r="8" fill="#fff"/>`);
