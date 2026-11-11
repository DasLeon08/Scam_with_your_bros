// Renders the Toki banner (1600×800) and the square picture (1024×1024) from the game's own art.
// Usage: npx tsx scripts/promo-art.ts  → toki/banner.png, toki/square.png
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import * as art from "../client/src/art";

const root = join(import.meta.dirname, "..");
const fonts = `file://${join(root, "client/public/fonts")}`;
const css = `
@font-face { font-family: "Lilita"; src: url(${fonts}/lilita-one.woff2); }
@font-face { font-family: "Nunito"; font-weight: 900; src: url(${fonts}/nunito-900.woff2); }
* { margin: 0; box-sizing: border-box; }
body { overflow: hidden; font-family: "Nunito"; font-weight: 900; color: #1b1530;
  background-color: #1f6f6b;
  background-image: radial-gradient(circle at 25% 25%, rgba(255,255,255,.08) 3px, transparent 3.5px), radial-gradient(circle at 75% 75%, rgba(0,0,0,.12) 3px, transparent 3.5px);
  background-size: 40px 40px; position: relative; }
.burst { position: absolute; border-radius: 50%; background: repeating-conic-gradient(rgba(255,198,59,.22) 0 9deg, transparent 9deg 18deg); }
.title { font-family: "Lilita"; color: #ffc63b; -webkit-text-stroke: 5px #1b1530; text-shadow: 9px 9px 0 #1b1530; line-height: .86; letter-spacing: 1px; paint-order: stroke fill; }
.title span { color: #ff5d8f; display: block; }
.chip { display: inline-block; background: #fff4dc; border: 4px solid #1b1530; border-radius: 999px; padding: 6px 20px; box-shadow: 5px 5px 0 #1b1530; }
.bubble { position: absolute; background: #fff; border: 5px solid #1b1530; border-radius: 26px; box-shadow: 7px 7px 0 #1b1530; padding: 16px 26px; font-size: 34px; }
.bubble:after { content: ""; position: absolute; bottom: -38px; border: 18px solid transparent; border-top: 22px solid #1b1530; }
.bubble.l:after { left: 70px; }
.bubble.r:after { right: 90px; }
.desk { position: absolute; background: #fff4dc; border: 6px solid #1b1530; border-radius: 22px; box-shadow: 8px 8px 0 #1b1530; }
.abs { position: absolute; }
`;
const page = (w: number, h: number, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${css} body{width:${w}px;height:${h}px}</style></head><body>${body}</body></html>`;

const svg = (s: string, w: number) => s.replace(/width="\d+" height="\d+"/, `width="${w}" height="${w}"`);

const banner = page(1600, 800, `
  <div class="burst" style="width:1500px;height:1500px;left:620px;top:-340px"></div>
  <div class="abs" style="left:80px;top:90px">
    <div class="title" style="font-size:150px">Scam with<span>your Bros</span></div>
    <p style="margin-top:34px;font-size:40px;color:#fff;text-shadow:4px 4px 0 #1b1530;max-width:660px;line-height:1.2">
      Das absurdeste Callcenter der Welt. Quatscht KI-Anrufer weich und überlebt den Chef!</p>
    <div style="margin-top:34px;display:flex;gap:16px;font-size:28px">
      <span class="chip">👥 2–8 Bros</span><span class="chip">🔑 Raumcode</span><span class="chip">🍞 100 % fiktiv</span>
    </div>
  </div>
  <div class="bubble l" style="left:840px;top:60px">Ihr Toaster hat einen Virus!</div>
  <div class="bubble r" style="left:1210px;top:190px;font-size:30px;background:#ffc63b;transform:rotate(3deg)">Mehr Toaster! MEHR!</div>
  <div class="abs" style="left:1230px;top:250px">${svg(art.boss(), 360)}</div>
  <div class="abs" style="left:840px;top:330px;display:flex">
    ${svg(art.bro("#ffc63b", "cap"), 270)}${svg(art.bro("#ff5d8f", "bun"), 270)}
  </div>
  <div class="desk" style="left:800px;top:590px;width:860px;height:260px"></div>
  <div class="abs" style="left:850px;top:500px;transform:rotate(-10deg)">${svg(art.phone(), 130)}</div>
  <div class="abs" style="left:1010px;top:636px;font-family:Lilita;font-size:60px;color:#ff5d8f;-webkit-text-stroke:3px #1b1530;letter-spacing:2px">BROS INC.</div>
  <div class="abs" style="left:1012px;top:712px;font-size:28px;letter-spacing:6px;color:#1f6f6b">CALLCENTER</div>
`);

// Toki shows the picture cropped to a wide card (about 1.4:1), so everything sits in the middle band
const square = page(1024, 1024, `
  <div class="burst" style="width:1700px;height:1700px;left:-338px;top:-338px"></div>
  <div class="abs" style="left:0;right:0;top:200px;text-align:center">
    <div class="title" style="font-size:112px;-webkit-text-stroke:4px #1b1530;text-shadow:7px 7px 0 #1b1530">Scam with<span>your Bros</span></div>
  </div>
  <div class="abs" style="left:327px;top:436px">${svg(art.bro("#ffc63b", "cap"), 370)}</div>
  <div class="abs" style="left:-6px;right:-6px;top:742px;height:92px;background:#ff5d8f;border-top:6px solid #1b1530;border-bottom:6px solid #1b1530;
    display:grid;place-items:center;font-family:Lilita;font-size:54px;color:#fff;text-shadow:4px 4px 0 #1b1530;letter-spacing:4px">BROS INC.</div>
  <div class="abs" style="left:690px;top:480px;transform:rotate(14deg)">${svg(art.phone(), 130)}</div>
`);

mkdirSync(join(root, "toki/art"), { recursive: true });
const browser = await chromium.launch();
for (const [name, html, w, h] of [["banner", banner, 1600, 800], ["square", square, 1024, 1024]] as const) {
  const file = join(root, "toki/art", `${name}.html`);
  writeFileSync(file, html);
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto(`file://${file}`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(root, "toki", `${name}.png`) });
  await p.close();
}
await browser.close();
console.log("toki/banner.png (1600×800) and toki/square.png (1024×1024)");
