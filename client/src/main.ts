import "./style.css";
import {
  COLORS,
  PITCH_WORDS,
  HAIRS,
  RULES,
  SCHEMES,
  SHOP,
  normalizeCode,
  personaById,
  schemeById,
  type CallView,
  type GameEvent,
  type PlayerView,
  type RoomState,
} from "@bros/shared";
import * as art from "./art";
import { Connection, createRoom, inToki, linkCode, onTokiHost, onTokiName, tellToki, tokiScore, wakeServer, type Profile } from "./net";
import { TUTORIAL, markTutorialDone, tutorialDone } from "./tutorial";

/* ================================================================== */
/* state                                                              */
/* ================================================================== */

const stage = document.getElementById("stage")!;
let conn: Connection | null = null;
let me = "";
let S: RoomState | null = null;
let titleError = "";
let busy = false;
let lastCallId: string | null = null;
let resultCall: CallView | null = null;
let nameTouched = false;
let scored = "";
const invited = normalizeCode(linkCode());

const PROFILE_KEY = "bros.profile";
function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}");
    return {
      name: typeof p.name === "string" ? p.name.slice(0, 16) : "",
      color: COLORS.includes(p.color) ? p.color : COLORS[Math.floor(Math.random() * COLORS.length)],
      hair: HAIRS.includes(p.hair) ? p.hair : HAIRS[Math.floor(Math.random() * HAIRS.length)],
    };
  } catch {
    return { name: "", color: COLORS[0], hair: HAIRS[0] };
  }
}
let profile = loadProfile();
const saveProfile = () => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
};

/* ================================================================== */
/* helpers                                                            */
/* ================================================================== */

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => stage.querySelector<T>(sel);
const now = () => (conn ? conn.serverNow() : Date.now());
const player = (id: string | null | undefined) => S?.players.find((p) => p.id === id);
const meP = () => player(me);
const isHost = () => S?.hostId === me;
const myCall = () => S?.calls.find((c) => c.playerId === me && !c.ended);
const myHack = () => S?.hacks.find((h) => h.playerId === me);
const first = (name: string) => name.replace(/^(Prof\. Dr\. |Herr |Frau )/, "").split(" ")[0];
const avatar = (p: Pick<PlayerView, "color" | "hair">, w: number) => `<span>${art.bro(p.color, p.hair, w)}</span>`;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function fit() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener("resize", fit);
fit();

function toast(text: string, kind: "" | "good" | "bad" = "") {
  const box = $("#toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  box.append(el);
  setTimeout(() => el.remove(), 3400);
}

/* ================================================================== */
/* connection                                                         */
/* ================================================================== */

function join(code: string) {
  conn?.close();
  busy = true;
  renderTitleError("Verbinde…");
  conn = new Connection(code, profile, {
    onWelcome(you, state) {
      busy = false;
      me = you;
      S = state;
      titleError = "";
      tellToki(state.code);
      render();
    },
    onState(state) {
      S = state;
      render();
    },
    onEvent: onEvent,
    onError(code) {
      if (code === "need_players") toast(`Mindestens ${RULES.minPlayers} Bros nötig, um zu starten.`, "bad");
    },
    onClosed(reason) {
      busy = false;
      const msg = {
        not_found: "Diesen Raum gibt es nicht (mehr). Prüf den Code.",
        full: `Der Raum ist voll (${RULES.maxPlayers} von ${RULES.maxPlayers}).`,
        offline: "Keine Verbindung zum Spielserver. Versuch es gleich nochmal.",
        replaced: "Du hast den Raum in einem anderen Fenster geöffnet.",
      }[reason];
      leave(msg);
    },
  });
}

/** Opens a new room and joins it as host (the "Raum erstellen" button and Toki's "Invite friends"). */
async function createAndJoin() {
  if (busy || S) return;
  busy = true;
  renderTitleError("Raum wird erstellt…");
  const slow = setTimeout(() => busy && renderTitleError("Der Spielserver wacht gerade auf. Das kann bis zu einer Minute dauern…"), 4000);
  try {
    const code = await createRoom();
    clearTimeout(slow);
    join(code);
  } catch (err) {
    clearTimeout(slow);
    busy = false;
    titleError = (err as Error).message === "rate_limited" ? "Zu viele neue Räume. Warte kurz." : "Keine Verbindung zum Spielserver.";
    renderTitleError(titleError);
  }
}

function leave(error = "") {
  conn?.close();
  conn = null;
  S = null;
  me = "";
  lastCallId = null;
  resultCall = null;
  titleError = error;
  tellToki(null);
  render();
}

function send(msg: Parameters<Connection["send"]>[0]) {
  conn?.send(msg);
}

function onEvent(e: GameEvent) {
  const mine = "playerId" in e && e.playerId === me;
  const who = "playerId" in e ? player(e.playerId)?.name ?? "Jemand" : "";
  switch (e.kind) {
    case "paid":
      toast(`💸 ${mine ? "Du hast" : `${who} hat`} ${e.amount} Bro-Bucks von ${first(e.name)} geholt!`, "good");
      break;
    case "lost":
      if (e.outcome !== "dropped") toast(`📴 ${first(e.name)} hat bei ${mine ? "dir" : who} aufgelegt.`, "bad");
      break;
    case "intel":
      toast(`🔓 ${mine ? "Du hast" : `${who} hat`} Intel gefunden!`, "good");
      break;
    case "missed":
      toast(`☎️ ${first(e.name)} hat zu lange gewartet und aufgelegt.`, "bad");
      break;
    case "exposed":
      toast(`🕵️ Scambaiter enttarnt! +${e.bonus} Bro-Bucks`, "good");
      break;
    case "baited":
      showBaiter(e.name, e.penalty, who);
      break;
    case "bought":
      toast(`🛒 Gekauft: ${SHOP.find((i) => i.id === e.itemId)?.title ?? e.itemId}`, "good");
      break;
    case "filtered":
      toast("🚫 Links, Codes und Nummern sind im Chat nicht erlaubt.", "bad");
      break;
  }
}

/* ================================================================== */
/* screens                                                            */
/* ================================================================== */

interface Mounted {
  key: string;
  update(): void;
}
let screen: Mounted | null = null;

function render() {
  const key = !S ? "title" : S.phase;
  if (screen?.key !== key) {
    stage.innerHTML = "";
    screen = MOUNTS[key]();
    stage.insertAdjacentHTML("beforeend", `<div class="toasts" id="toasts"></div><div id="overlay"></div>`);
  }
  screen.update();
}

const MOUNTS: Record<string, () => Mounted> = { title: mountTitle, lobby: mountLobby, day: mountDay, review: mountReview, shop: mountShop };

/* ---------------- title ---------------- */

function renderTitleError(text: string) {
  const el = $("#title-err");
  if (el) el.textContent = text;
}

function mountTitle(): Mounted {
  stage.innerHTML = `
  <section class="screen title-wrap">
    <div>
      <h1 class="bigtitle">Scam with<span>your Bros</span></h1>
      <p class="tagline">Willkommen bei <b style="color:var(--mustard)">Bros Inc.</b> – dem absurdesten Callcenter der Welt. Erfinde Maschen, quatsch Fantasie-Anrufer weich und überlebe die Bewertung vom Chef.</p>
      <div style="margin-top:22px; display:flex; gap:10px; flex-wrap:wrap">
        <span class="chip">👥 2–8 Spieler</span><span class="chip">🔑 Nur mit Raumcode</span><span class="chip">🧠 Schlaue Anrufer</span><span class="chip">🍞 100 % fiktiv</span>
      </div>
      <div class="building">${art.building()}</div>
    </div>
    <form class="panel join-card" data-form="join" autocomplete="off">
      ${invited ? `<div class="invite">💌 Du bist in Raum <b>${invited}</b> eingeladen!</div>` : ""}
      <label for="name">Dein Name</label>
      <input id="name" class="input" maxlength="16" placeholder="z. B. Leon" value="${esc(profile.name)}">
      <label>Dein Bro</label>
      <div class="colors" id="colors"></div><div class="hairs" id="hairs"></div>
      <button type="button" class="btn ${invited ? "ghost" : "pink"}" data-act="create">📞 ${invited ? "Lieber eigenen Raum erstellen" : "Raum erstellen"}</button>
      <div class="or">– oder mit Code beitreten –</div>
      <input id="code" class="input code-in" maxlength="5" placeholder="CODE" value="${esc(linkCode())}" aria-label="Raumcode">
      <button type="submit" class="btn ${invited ? "pink" : ""}" id="join-btn">${invited ? `Raum ${invited} beitreten` : "Beitreten"}</button>
      <div class="err" id="title-err" role="status"></div>
      <button type="button" class="btn ghost sm" data-act="tutorial" title="Kurze Anleitung">❓ So geht's</button>
    </form>
  </section>`;
  const codeIn = $<HTMLInputElement>("#code")!;
  codeIn.addEventListener("input", () => (codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  if (invited) setTimeout(() => $<HTMLButtonElement>("#join-btn")?.focus(), 0);
  $<HTMLInputElement>("#name")!.addEventListener("input", (e) => {
    nameTouched = true;
    profile.name = (e.target as HTMLInputElement).value.slice(0, 16);
    saveProfile();
  });
  return {
    key: "title",
    update() {
      $("#colors")!.innerHTML = COLORS.map((c) => `<button type="button" data-act="color" data-v="${c}" class="${c === profile.color ? "sel" : ""}" style="background:${c}" aria-label="Farbe ${c}"></button>`).join("");
      $("#hairs")!.innerHTML = HAIRS.map((h) => `<button type="button" data-act="hair" data-v="${h}" class="${h === profile.hair ? "sel" : ""}" aria-label="Frisur ${h}">${art.bro(profile.color, h, 40)}</button>`).join("");
      renderTitleError(titleError);
    },
  };
}

/* ---------------- shared bits ---------------- */

function chatPanel(height: number) {
  return `<div class="panel teamchat" style="height:${height}px">
    <h3>💬 Team-Chat</h3>
    <div class="tc-msgs scroll" id="tc-msgs"></div>
    <form class="row" data-form="chat" autocomplete="off"><input id="tc-in" class="input" maxlength="200" placeholder="Nachricht ans Team…"><button class="btn xs">➤</button></form>
  </div>`;
}

function updateChat() {
  const box = $("#tc-msgs");
  if (!box || !S) return;
  const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 30;
  box.innerHTML = S.chat
    .map((m) => {
      if (!m.playerId) return `<div class="sys">${esc(m.text)}</div>`;
      const p = player(m.playerId);
      return `<div><b style="color:${p ? "var(--ink)" : "#888"}">${esc(p?.name ?? "?")}:</b>${esc(m.text)}</div>`;
    })
    .join("");
  if (stick) box.scrollTop = box.scrollHeight;
}

function bossTick() {
  return `<div class="panel boss-tick"><span>${art.boss(54)}</span><p><b>CHEF BRUNO</b>«${esc(S!.bossLine)}»</p></div>`;
}

/* ---------------- lobby ---------------- */

function mountLobby(): Mounted {
  stage.innerHTML = `
  <section class="screen lobby">
    <div class="panel codebox">
      <div class="row"><h2 style="font-size:30px">Dein Raum</h2><span class="chip" style="margin-left:auto">🧠 Schlaue Anrufer</span></div>
      <div class="code-big" id="code-big"></div>
      <div class="row"><button class="btn ghost sm" data-act="copy">📋 Code kopieren</button><button class="btn ghost sm" data-act="tutorial">❓ So geht's</button><button class="btn ghost sm" data-act="leave">🚪</button></div>
      <p class="hint">${inToki ? "Teile den Code oder nutze «Invite friends» auf Toki. " : ""}Freunde treten nur mit diesem Code bei. Es gibt keine öffentlichen Räume und kein Matchmaking.</p>
      <div class="steps"><b class="display" style="font-size:17px">So läuft eine Schicht</b><br>
        ☎️ Anrufe annehmen und eine Masche wählen<br>💬 Den Anrufer im Chat überzeugen<br>💻 Kollegen hacken Infos vom Fantasie-PC<br>🎯 Tagesquote knacken, Chef glücklich machen</div>
      <div style="margin-top:auto; display:flex; flex-direction:column; gap:10px" id="lobby-start"></div>
    </div>
    <div class="panel players">
      <div class="row"><h1 style="font-size:40px">Die Belegschaft</h1><span class="chip" style="margin-left:auto" id="count"></span></div>
      <div class="pgrid" id="pgrid"></div>
      <div class="bossbox" id="bossbox"></div>
      ${chatPanel(0).replace('class="panel teamchat" style="height:0px"', 'class="teamchat" style="flex:1; min-height:0; height:auto; border:3px solid var(--ink); border-radius:14px; background:#fff"')}
    </div>
  </section>`;
  return {
    key: "lobby",
    update() {
      const s = S!;
      $("#code-big")!.textContent = s.code;
      const online = s.players.filter((p) => p.connected);
      $("#count")!.textContent = `${online.length} / ${RULES.maxPlayers}`;
      const cards = online.map(
        (p) => `<div class="pcard ${p.id === me ? "me" : ""}">${p.host ? `<div class="crown">${art.crown()}</div>` : ""}${art.bro(p.color, p.hair, 76)}<b>${esc(p.name)}${p.id === me ? " (du)" : ""}</b>
          <span class="chip" style="background:${p.host ? "var(--mustard)" : "var(--mint)"}">${p.host ? "Host" : "Bereit"}</span></div>`,
      );
      while (cards.length < RULES.maxPlayers) cards.push(`<div class="pcard empty">Platz frei</div>`);
      $("#pgrid")!.innerHTML = cards.join("");
      $("#bossbox")!.innerHTML = `<span style="flex:none">${art.boss(64)}</span><p style="font-size:16px; font-weight:800"><b>CHEF BRUNO BRÜLLMANN:</b>«${esc(s.bossLine)}»</p>`;
      const host = player(s.hostId);
      const enough = online.length >= RULES.minPlayers;
      $("#lobby-start")!.innerHTML = `
        <div class="row" style="flex-wrap:wrap">${RULES.dayOptions
          .map((d) =>
            isHost()
              ? `<button class="chip ${s.daySeconds === d ? "on" : ""}" data-act="daylen" data-v="${d}">⏱ ${d / 60} Min.</button>`
              : s.daySeconds === d ? `<span class="chip">⏱ Tag: ${d / 60} Min.</span>` : "",
          )
          .join("")}<span class="chip">🎯 ${s.quota} BB</span></div>
        ${isHost()
          ? `<button class="btn pink" style="font-size:26px; padding:8px 22px" data-act="start" ${enough ? "" : "disabled"}>▶ Schicht starten</button>
             <p class="hint" style="text-align:center">${enough ? `${online.length} von ${RULES.maxPlayers} Bros da` : `Warte auf mindestens ${RULES.minPlayers} Bros. Teile den Code!`}</p>`
          : `<p class="hint" style="text-align:center; font-size:17px">Warte, bis ${esc(host?.name ?? "der Host")} die Schicht startet…</p>`}`;
      updateChat();
    },
  };
}

/* ---------------- day ---------------- */

const OS: Record<string, string> = { gustav: "GrummelOS 3.1", kiki: "GlitzerOS ✨", balduin: "KnopfDOS 6.0", wilma: "TurboSchneck XP", bluemchen: "BlümchenOS" };

function mountDay(): Mounted {
  stage.innerHTML = `
  <section class="screen">
    <div class="panel top" id="top"></div>
    <div class="day">
      <div class="col"><div id="left" style="flex:1; display:flex; min-height:0"></div>${chatPanel(186)}</div>
      <div class="panel center" id="center"></div>
      <div class="col side" id="side"></div>
    </div>
  </section>`;
  let centerKey = "";
  return {
    key: "day",
    update() {
      const s = S!;
      const call = myCall();
      const hack = myHack();
      if (call) {
        lastCallId = call.id;
        resultCall = null;
      } else if (lastCallId) {
        const ended = s.calls.find((c) => c.id === lastCallId);
        if (ended?.ended) resultCall = ended;
        lastCallId = null;
      }
      if (hack) resultCall = null;

      // top bar
      $("#top")!.innerHTML = `
        <div class="logo-s">Bros Inc.<small>CALLCENTER</small></div>
        <div class="clock"><span style="font-size:24px">🕑</span><b>Tag ${s.day} · <span data-clock></span></b></div>
        <div class="quota"><span class="display" style="font-size:18px">Quote</span>
          <div class="bar"><i style="width:${Math.min(100, (s.bucks / s.quota) * 100)}%; background:${s.bucks >= s.quota ? "var(--mustard)" : "var(--mint)"}"></i><span>${s.bucks} / ${s.quota} Bro-Bucks${s.bucks >= s.quota ? " ✔" : ""}</span></div></div>
        <span class="roomchip" title="Raumcode">${esc(s.code)}</span>
        <div class="avs">${s.players.map((p) => `<span class="${p.connected ? "" : "off"}" title="${esc(p.name)}">${art.bro(p.color, p.hair, 38)}</span>`).join("")}</div>
        ${isHost() ? `<button class="btn xs ghost" data-act="endday" title="Schicht für alle beenden">🔔 Feierabend</button>` : ""}
        <button class="btn xs ghost" data-act="leave" title="Raum verlassen">🚪</button>`;

      // left: the caller I'm dealing with, or my desk
      const target = call ?? (hack && s.calls.find((c) => c.id === hack.callId)) ?? (resultCall && !hack ? resultCall : null);
      $("#left")!.innerHTML = target ? callerCard(target) : deskCard();

      // center
      let key: string;
      if (call && !call.schemeId) key = `scheme:${call.id}`;
      else if (call) key = `call:${call.id}`;
      else if (hack) key = `hack:${hack.callId}`;
      else if (resultCall) key = `result:${resultCall.id}`;
      else key = "office";
      const center = $("#center")!;
      if (key !== centerKey) {
        centerKey = key;
        center.innerHTML = key.startsWith("call:") ? callSkeleton() : "";
        if (key.startsWith("call:")) setTimeout(() => $<HTMLInputElement>("#say")?.focus(), 0);
      }
      if (key.startsWith("call:")) updateCall(call!);
      else if (key.startsWith("scheme:")) center.innerHTML = schemePicker(call!);
      else if (key.startsWith("hack:")) center.innerHTML = hackView();
      else if (key.startsWith("result:")) center.innerHTML = resultView(resultCall!);
      else center.innerHTML = officeView();

      // right side
      const free = !call;
      $("#side")!.innerHTML = `
        ${key === "office" ? "" : `<div class="panel"><h3>📞 Warteschlange (${s.queue.length})</h3>${
          s.queue.length
            ? s.queue.map((q) => `<div class="qitem">${art.caller(q.avatar, 30)}<div><b>${esc(q.name)}</b></div><span class="t" data-ends="${q.expiresAt}"></span></div>`).join("")
            : `<p class="hint">Gerade ruhig…</p>`
        }${free ? "" : `<p class="disc">Erst auflegen, dann abnehmen.</p>`}</div>`}
        <div class="panel"><h3>🧑‍🤝‍🧑 Team</h3>${s.players
          .map((p) => `<div class="mate-row" style="${p.connected ? "" : "opacity:.5"}">${avatar(p, 30)}<div><b>${esc(p.name)}${p.id === me ? " (du)" : ""}</b><span class="st">${esc(p.status)}</span></div></div>`)
          .join("")}</div>
        ${bossTick()}`;
      updateChat();
      tickTimers();
    },
  };
}

function trustBar(trust: number, h = 26) {
  return `<div class="bar" style="height:${h}px"><i style="width:${trust}%; background:linear-gradient(90deg,var(--red),var(--mustard) 45%,var(--mint))"></i></div>`;
}

function callerCard(c: CallView) {
  const persona = personaById(c.personaId);
  const revealed = c.outcome === "baited" && persona?.baiter;
  return `<div class="panel caller">
    <div class="portrait" style="background:${revealed ? "#2f2a45" : c.bg}">${art.caller(c.avatar, 136, !!revealed)}${c.ended ? "" : `<span class="chip ring" style="background:var(--mint)">● Live</span>`}</div>
    <div><h2>${esc(revealed ? persona!.baiter!.realName : c.name)}</h2><div class="sub">${esc(revealed ? persona!.baiter!.realTagline : c.tagline)}</div></div>
    <div class="traits">${c.traits.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
    <div class="trust-l"><span>Vertrauen</span><span>${Math.round(c.trust)} %</span></div>
    ${trustBar(c.trust)}
    <div class="sub">Stimmung: <b>${esc(c.mood)}</b>${c.playerId !== me ? ` · am Telefon: <b>${esc(player(c.playerId)?.name ?? "?")}</b>` : ""}</div>
    ${c.intel.map((i) => `<div class="intel ${i.used ? "used" : ""}"><b>🔓 Intel von ${esc(i.by)}${i.used ? " · benutzt" : ""}</b>${esc(i.label)}</div>`).join("")}
    ${c.hiddenIntel > 0 ? `<div class="sub">💻 Auf dem PC sind noch ${c.hiddenIntel} Datei${c.hiddenIntel === 1 ? "" : "en"} versteckt.</div>` : ""}
  </div>`;
}

function deskCard() {
  const p = meP()!;
  return `<div class="panel desk-me">
    ${art.bro(p.color, p.hair, 110)}
    <h2 style="font-size:24px">${esc(p.name)}</h2>
    <div class="statline">
      <div><b>${p.stats.calls}</b>Anrufe</div><div><b>${p.stats.wins}</b>Erfolge</div>
      <div><b>${p.stats.bucks}</b>Bro-Bucks</div><div><b>${p.stats.hacks}</b>Hacks</div>
    </div>
    <p class="hint" style="font-size:13px">Nimm ein klingelndes Telefon ab oder hilf Kollegen: Hack den PC ihres Anrufers und finde Infos, die Vertrauen bringen.</p>
  </div>`;
}

function officeView() {
  const s = S!;
  const others = s.calls.filter((c) => !c.ended && c.playerId !== me);
  const hackBusy = !!myHack();
  return `<div class="office scroll">
    <div class="row"><span>${art.phone(44)}</span><h2>Es klingelt!</h2><span class="chip" style="margin-left:auto">${s.queue.length} in der Leitung</span></div>
    ${s.queue.length
      ? `<div class="ringing">${s.queue
          .map((q, i) => `<div class="ringcard ${i === 0 ? "hot" : ""}">${art.caller(q.avatar, 54)}<div class="info"><b>${esc(q.name)}</b>${esc(q.tagline)}</div>
            <div style="text-align:center"><div class="t" data-ends="${q.expiresAt}"></div><button class="btn xs pink" data-act="answer" data-v="${q.id}">📞 Abnehmen</button></div></div>`)
          .join("")}</div>`
      : `<div class="empty-note">Gerade klingelt nichts. Gleich geht's weiter!</div>`}
    <div class="row" style="margin-top:6px"><h2 style="font-size:22px">🧑‍💻 Laufende Gespräche</h2></div>
    ${others.length
      ? others
          .map((c) => {
            const p = player(c.playerId);
            return `<div class="livecall">${art.caller(c.avatar, 44)}<div class="info"><b style="font-size:14px">${esc(c.name)}</b> mit ${esc(p?.name ?? "?")}${c.schemeId ? ` · «${esc(schemeById(c.schemeId)?.title)}»` : " · wählt Masche"}
              <div class="bar"><i style="width:${c.trust}%; background:var(--mustard)"></i></div></div>
              ${c.hiddenIntel > 0
                ? `<button class="btn xs mint" data-act="hack" data-v="${c.id}" ${hackBusy ? "disabled" : ""}>💻 PC hacken</button>`
                : `<span class="chip">🔒 Alles gefunden</span>`}</div>`;
          })
          .join("")
      : `<div class="empty-note">Niemand telefoniert gerade. Sobald ein Kollege telefoniert, kannst du hier den PC seines Anrufers hacken.</div>`}
  </div>`;
}

function schemePicker(c: CallView) {
  const s = S!;
  return `<div class="schemes">
    <div class="row"><h2>Wähle deine Masche für ${esc(first(c.name))}</h2><span class="timer display" style="margin-left:auto; font-size:20px">⏳ <span data-ends="${c.endsAt}"></span></span></div>
    <p class="hint">${esc(c.name)} ist dran und wartet. Welche absurde Geschichte erzählst du?</p>
    <div class="sgrid">${SCHEMES.map((sc) => {
      const open = s.schemes.includes(sc.id);
      return open
        ? `<button class="scard" data-act="scheme" data-v="${sc.id}"><span class="em">${sc.emoji}</span><b>«${esc(sc.title)}»</b><span class="sub">Ziel: ${sc.amount} Bro-Bucks für die ${esc(sc.goal)}</span></button>`
        : `<div class="scard" style="opacity:.5; cursor:default"><span class="em">🔒</span><b>«${esc(sc.title)}»</b><span class="sub">Im Bro-Shop freischalten</span></div>`;
    }).join("")}</div>
    <div><button class="btn ghost sm" data-act="hangup" data-v="${c.id}">📴 Auflegen</button></div>
  </div>`;
}

function callSkeleton() {
  return `<div class="chat-h" id="call-h"></div>
    <div class="msgs scroll" id="msgs"></div>
    <div class="composer">
      <div class="typing" id="typing"></div>
      <div class="sugg" id="sugg"></div>
      <form class="row" data-form="say" autocomplete="off"><input id="say" class="input" maxlength="220" placeholder="Was sagst du dem Anrufer?"><button class="btn sm" id="say-btn">Senden ➤</button></form>
    </div>`;
}

function updateCall(c: CallView) {
  const sc = schemeById(c.schemeId!)!;
  $("#call-h")!.innerHTML = `<span style="font-size:26px">${sc.emoji}</span><div><div class="display">Masche: «${esc(sc.title)}»</div><div style="font-size:12px">Ziel: ${sc.amount} Bro-Bucks für die ${esc(sc.goal)} · Runde ${c.turns}/${c.patience}</div></div><span class="timer">⏳ <span data-ends="${c.endsAt}"></span></span>`;
  const box = $("#msgs")!;
  box.innerHTML = c.messages.map((m) => msgHtml(c, m)).join("");
  box.scrollTop = box.scrollHeight;
  $("#typing")!.textContent = c.thinking ? `${first(c.name)} denkt nach…` : "";
  const persona = personaById(c.personaId);
  const chips = c.intel
    .filter((i) => !i.used)
    .map((i) => `<button class="chip hot" data-act="insert" data-v="${esc(`Ich weiss da was: ${i.label}`)}">🔓 Intel: ${esc(i.label.slice(0, 34))}${i.label.length > 34 ? "…" : ""}</button>`);
  // suggest words that weren't used yet in this call (repeating them doesn't impress anyone)
  const said = c.messages.filter((m) => m.from === "player").map((m) => m.text.toLowerCase()).join(" ");
  for (const k of sc.keywords.filter((w) => !said.includes(w)).slice(0, 3)) chips.push(`<button class="chip" data-act="insert" data-v="${esc(k)}">💡 ${esc(k)}</button>`);
  const like = persona?.likes.find((w) => !said.includes(w) && w.length > 3);
  if (like) chips.push(`<button class="chip" data-act="insert" data-v="${esc(like)}">💛 ${esc(like)}</button>`);
  const pitch = PITCH_WORDS.find((w) => !said.includes(w));
  if (pitch) chips.push(`<button class="chip" data-act="insert" data-v="${esc(pitch)}">✨ ${esc(pitch)}</button>`);
  chips.push(`<button class="chip" data-act="hangup" data-v="${c.id}">📴 Auflegen</button>`);
  $("#sugg")!.innerHTML = chips.join("");
  const btn = $<HTMLButtonElement>("#say-btn")!;
  btn.disabled = c.thinking;
}

function msgHtml(c: CallView, m: CallView["messages"][number]) {
  if (m.from === "system") return `<div class="msg sysm">${esc(m.text)}</div>`;
  if (m.from === "caller") {
    return `<div class="msg"><span>${art.caller(c.avatar, 36, c.outcome === "baited")}</span><div class="bubble"><span class="who">${esc(first(c.name))}</span>${esc(m.text)}</div></div>`;
  }
  const p = player(m.playerId);
  const d = m.delta === undefined ? "" : `<span class="delta ${m.delta < 0 ? "neg" : ""}">${m.delta > 0 ? "+" : ""}${m.delta}</span>`;
  return `<div class="msg ${m.playerId === me ? "me" : "mate"}">${p ? avatar(p, 36) : ""}<div class="bubble"><span class="who">${esc(p?.name ?? "?")} · Bros Inc.</span>${esc(m.text)}${d}</div></div>`;
}

function hackView() {
  const s = S!;
  const h = myHack()!;
  const c = s.calls.find((x) => x.id === h.callId);
  const persona = c ? personaById(c.personaId) : undefined;
  const os = (persona && OS[persona.id]) || "BroOS";
  const found = h.result
    ? `<div class="panel found ${h.result === "fail" ? "fail" : ""}">
        ${h.result === "win"
          ? `<h3>🔓 Intel gefunden!</h3><p style="font-size:14px; margin:6px 0 10px">${esc(h.found)}</p><p class="disc">Steht jetzt beim Gespräch. Wer es erwähnt, bekommt Vertrauen.</p>`
          : `<h3>⌛ Zu langsam!</h3><p style="font-size:14px; margin:6px 0 10px">Die Firewall hat dich rausgeworfen.</p>`}
        <div class="row" style="margin-top:8px">${h.result === "fail" && c && !c.ended ? `<button class="btn sm" data-act="hack" data-v="${h.callId}">Nochmal</button>` : ""}<button class="btn sm ghost" data-act="closehack">Schliessen</button></div>
      </div>`
    : "";
  return `<div class="desk">
    <div class="desk-bar"><div class="dots"><i></i><i></i><i></i></div>Fernzugriff 😎 · <span class="mono">${esc(os)}</span> · ${esc(c ? first(c.name) : "?")}s Rechner
      <span class="chip" style="margin-left:auto">⏱ <span data-ends="${h.endsAt}"></span></span><button class="btn xs ghost" data-act="closehack">✕</button></div>
    <div class="wall">
      <div class="icons">
        <div class="icon"><div class="ic">📁</div>Dokumente</div>
        <div class="icon"><div class="ic">🐾</div>Haustiere.txt</div>
        <div class="icon lock"><div class="ic">🔒</div>GEHEIM</div>
        <div class="icon"><div class="ic">🗑</div>Papierkorb</div>
      </div>
      <div class="win">
        <div class="wt"><span>Terminal von ${esc(meP()?.name)}</span><span>${h.progress}/${h.sequence.length}</span></div>
        <div class="term mono">
          <div><span class="y">&gt;</span> umgehe_firewall <span class="p">--mit-charme</span></div>
          <div>  Firewall fühlt sich geschmeichelt… ✔</div>
          <div><span class="y">&gt;</span> entschlüssle Krümel-Verschlüsselung</div>
          <div><span class="y">&gt;</span> tippe die Codes in dieser Reihenfolge:</div>
        </div>
        <div class="seq">${h.sequence.map((code, i) => `<span class="${i < h.progress ? "done" : i === h.progress ? "next" : ""}">${code}</span>`).join("")}</div>
        <div class="hexgrid">${h.grid
          .map((code, i) => `<button data-act="tap" data-v="${i}" class="${h.sequence.indexOf(code) > -1 && h.sequence.indexOf(code) < h.progress ? "ok" : ""}" ${h.result ? "disabled" : ""}>${code}</button>`)
          .join("")}</div>
      </div>
      ${found}
    </div>
    <div class="taskbar"><span class="start">Start</span><span>Terminal</span><span class="disc" style="margin-left:auto">Reine Fantasie-Hackerei. Falsche Taste = −2 s.</span></div>
  </div>`;
}

function resultView(c: CallView) {
  const map: Record<string, [string, string]> = {
    paid: ["💸", `+${c.amount ?? 0} Bro-Bucks!`],
    hangup: ["📴", "Aufgelegt!"],
    timeout: ["⌛", "Keine Zeit mehr!"],
    dropped: ["📴", "Du hast aufgelegt."],
    baited: ["🐱", "Scambaiter!"],
    exposed: ["🕵️", `Enttarnt! +${c.amount ?? 0}`],
  };
  const [em, title] = map[c.outcome ?? "dropped"];
  const lastCaller = [...c.messages].reverse().find((m) => m.from === "caller");
  return `<div class="result"><div>
    <div style="font-size:80px">${em}</div>
    <h1>${esc(title)}</h1>
    ${lastCaller ? `<p style="font-size:17px; margin:14px auto; max-width:460px">«${esc(lastCaller.text)}»<br><span class="sub">– ${esc(c.name)}</span></p>` : ""}
    <button class="btn pink" data-act="dismiss" style="margin-top:10px">Zurück ins Büro</button>
  </div></div>`;
}

/* ---------------- review ---------------- */

function mountReview(): Mounted {
  stage.innerHTML = `<section class="screen boss">
    <div class="boss-l"><div class="panel speech" id="speech"></div><div class="boss-portrait">${art.bossBig()}</div></div>
    <div class="panel report" id="report"></div>
  </section>`;
  return {
    key: "review",
    update() {
      const r = S!.review!;
      if (scored !== `${S!.code}:${r.day}`) {
        scored = `${S!.code}:${r.day}`;
        tokiScore(r.bucks);
      }
      $("#speech")!.textContent = `«${r.line}»`;
      $("#report")!.innerHTML = `
        <div class="row" style="gap:16px">
          <div><div style="font-size:13px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:var(--teal)">Feierabend · Tag ${r.day}</div><h1>Chef-Bewertung</h1></div>
          <div class="stars" style="margin-left:auto" aria-label="${r.stars} von 5 Sternen">${[1, 2, 3, 4, 5].map((i) => art.star(i <= r.stars)).join("")}</div>
        </div>
        <div class="resgrid">
          <div><small>Tagesquote</small><b>${r.bucks} / ${r.quota}</b> <span class="chip" style="background:${r.bucks >= r.quota ? "var(--mint)" : "#ffd4d4"}">${r.bucks >= r.quota ? "✔ geschafft" : "✘ verfehlt"}</span></div>
          <div><small>Anrufe</small><b>${r.calls}</b> <span class="chip">${r.wins} erfolgreich</span></div>
          <div><small>Aufgelegt</small><b>${r.hangups}</b> ${r.baited ? `<span class="chip" style="background:#ffd4d4">${r.baited} Scambaiter</span>` : ""}</div>
        </div>
        <table><tr><th>Bro</th><th>Anrufe</th><th>Erfolge</th><th>Hacks</th><th>Bro-Bucks</th><th>Auszeichnung</th></tr>
          ${r.rows.map((row) => `<tr><td>${art.bro(row.color, row.hair, 28)}${esc(row.name)}</td><td>${row.stats.calls}</td><td>${row.stats.wins}</td><td>${row.stats.hacks}</td><td>${row.stats.bucks}</td><td><span class="award">${esc(row.award)}</span></td></tr>`).join("")}
        </table>
        <div class="notes">
          <div><b class="display" style="font-size:17px">📝 Notizen vom Chef</b><br>${r.notes.map(esc).join("<br>")}</div>
          <div><b class="display" style="font-size:17px">📅 Morgen: Tag ${r.day + 1}</b><br>Quote: <b>${r.nextQuota} BB</b><br>Team-Kasse: <b>${S!.wallet} BB</b> für den Shop</div>
        </div>
        <div class="row" style="margin-top:auto; justify-content:flex-end">
          ${isHost()
            ? `<button class="btn ghost" data-act="nextday">▶ Tag ${r.day + 1} starten</button><button class="btn pink" data-act="toshop">🛒 Ab in den Shop</button>`
            : `<p class="hint">Warte auf ${esc(player(S!.hostId)?.name ?? "den Host")}…</p><button class="btn ghost sm" data-act="leave">🚪 Verlassen</button>`}
        </div>`;
    },
  };
}

/* ---------------- shop ---------------- */

function mountShop(): Mounted {
  stage.innerHTML = `<section class="screen shop">
    <div class="panel shop-h" id="shop-h"></div>
    <div class="items" id="items"></div>
  </section>`;
  return {
    key: "shop",
    update() {
      const s = S!;
      $("#shop-h")!.innerHTML = `<span>${art.item.vending}</span>
        <div><h1>Bro-Shop</h1><div style="font-size:14px">Das Team kauft gemeinsam: Jeder stimmt ab, der Host kauft.</div></div>
        <div class="wallet">💰 ${s.wallet} BB</div>
        ${isHost() ? `<button class="btn pink" data-act="nextday">▶ Tag ${s.day + 1}</button>` : `<span class="hint">Warte auf den Host…</span>`}`;
      $("#items")!.innerHTML = SHOP.map((it) => {
        const owned = s.owned.includes(it.id);
        const voters = (s.votes[it.id] ?? []).map((id) => player(id)).filter(Boolean) as PlayerView[];
        const iVoted = voters.some((v) => v.id === me);
        return `<div class="panel item ${owned ? "owned" : ""}">
          ${owned ? `<span class="tag" style="background:var(--teal)">Gekauft</span>` : voters.length >= 2 ? `<span class="tag">Beliebt</span>` : ""}
          <div class="art" style="background:${it.bg}">${art.item[it.art] ?? ""}</div>
          <h3>${esc(it.title)}</h3><p>${esc(it.text)}</p>
          <div class="buy"><span class="price">${owned ? "✔" : `${it.price} BB`}</span>
            <div class="votes">${voters.map((v) => avatar(v, 26)).join("")}</div>
            ${owned ? "" : `<button class="btn xs ${iVoted ? "" : "ghost"}" data-act="vote" data-v="${it.id}">${iVoted ? "👍 Gestimmt" : "Abstimmen"}</button>
              ${isHost() ? `<button class="btn xs pink" data-act="buy" data-v="${it.id}" ${s.wallet >= it.price ? "" : "disabled"}>Kaufen</button>` : ""}`}
          </div></div>`;
      }).join("");
    },
  };
}

/* ---------------- tutorial ---------------- */

function showTutorial(step = 0) {
  const box = $("#overlay");
  if (!box) return;
  const t = TUTORIAL[step];
  const last = step === TUTORIAL.length - 1;
  box.innerHTML = `<div class="overlay"><div class="dim"></div>
    <div class="panel modal tut" role="dialog" aria-label="Anleitung" data-step="${step}">
      <button class="btn xs ghost tut-skip" data-act="tutskip">Überspringen ✕</button>
      <div class="tut-art" style="background:${t.bg}">${t.art}</div>
      <h2>${esc(t.title)}</h2>
      <p>${esc(t.text)}</p>
      <div class="tut-dots">${TUTORIAL.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div>
      <div class="row" style="justify-content:space-between">
        <button class="btn ghost sm" data-act="tutprev" ${step === 0 ? "disabled" : ""}>← Zurück</button>
        <button class="btn ${last ? "pink" : ""} sm" data-act="tutnext" autofocus>${last ? "Los geht's! 📞" : "Weiter →"}</button>
      </div>
    </div></div>`;
}

function closeTutorial() {
  markTutorialDone();
  const box = $("#overlay");
  if (box?.querySelector(".tut")) box.innerHTML = "";
}

/* ---------------- scambaiter overlay ---------------- */

function showBaiter(name: string, penalty: number, victim: string) {
  const box = $("#overlay");
  if (!box) return;
  const pops = [
    ["🐱 Katzen.exe", "Glückwunsch! Sie haben 400 Katzen abonniert!", 70, 120, -6],
    ["🐱 Katzen.exe", "Miau. Miau. Miau. (387 weitere)", 1010, 150, 5],
    ["🎺 Panflöte.mp3", "Ihr Headset spielt jetzt nur noch Panflöte.", 90, 520, 3],
    ["🐱 Katzen.exe", "Neue Katze! Sie heisst Kevin.", 1030, 510, -4],
    ["🧦 Socken.zip", "Sie haben 12 Paar Fantasie-Socken bestellt.", 560, 620, 2],
  ];
  box.innerHTML = `<div class="overlay">
    <div class="dim"></div>
    ${pops.map(([t, p, x, y, r]) => `<div class="popup" data-act="pop" style="left:${x}px; top:${y}px; transform:rotate(${r}deg)"><div class="wt"><span>${t}</span><span>✕</span></div><p>${p}</p></div>`).join("")}
    <div class="panel twist">
      <div class="band">PLOT-TWIST! SCAMBAITER!</div>
      <div class="body">
        <div class="portrait">${art.caller("agent", 190, true)}</div>
        <div>
          <h2 style="font-size:28px; line-height:1">«Herr Blümchen» ist in Wahrheit<br><span style="color:var(--pink)">${esc(name)}</span>!</h2>
          <p style="font-size:16px; margin-top:8px">«Haha! Ich habe ${esc(victim)} die ganze Zeit hingehalten. Jetzt schlage ICH zurück!»</p>
          <div class="effects"><div>💸 Team verliert bis zu <b>${penalty} Bro-Bucks</b></div><div>🐱 Katzen-Pop-ups auf allen Bildschirmen</div><div>🎺 Headsets spielen Panflöte</div></div>
          <button class="btn mint" data-act="unbait">🧹 Pop-ups wegklicken</button>
        </div>
      </div>
    </div>
  </div>`;
  setTimeout(() => (box.innerHTML = ""), 12000);
}

/* ================================================================== */
/* input                                                              */
/* ================================================================== */

stage.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!el || (el as HTMLButtonElement).disabled) return;
  const v = el.dataset.v ?? "";
  switch (el.dataset.act) {
    case "color":
      profile.color = v;
      saveProfile();
      screen?.update();
      break;
    case "hair":
      profile.hair = v;
      saveProfile();
      screen?.update();
      break;
    case "create":
      await createAndJoin();
      break;
    case "copy":
      try {
        await navigator.clipboard.writeText(S!.code);
        toast("Code kopiert!", "good");
      } catch {
        toast(`Code: ${S!.code}`);
      }
      break;
    case "leave":
      leave();
      break;
    case "daylen":
      send({ t: "settings", daySeconds: Number(v) });
      break;
    case "start":
      send({ t: "start" });
      break;
    case "endday":
      if (confirm("Schicht für alle beenden und zur Chef-Bewertung?")) send({ t: "endDay" });
      break;
    case "answer":
      send({ t: "answer", callId: v });
      break;
    case "scheme":
      send({ t: "scheme", callId: myCall()!.id, schemeId: v });
      break;
    case "hangup":
      send({ t: "hangup", callId: v });
      break;
    case "insert": {
      const input = $<HTMLInputElement>("#say");
      if (input) {
        input.value = `${input.value.trim()} ${v}`.trim().slice(0, 220);
        input.focus();
      }
      break;
    }
    case "hack":
      resultCall = null;
      send({ t: "hack", callId: v });
      break;
    case "tap":
      send({ t: "tap", index: Number(v) });
      break;
    case "closehack":
      send({ t: "closeHack" });
      break;
    case "dismiss":
      resultCall = null;
      render();
      break;
    case "toshop":
      send({ t: "toShop" });
      break;
    case "vote":
      send({ t: "vote", itemId: v });
      break;
    case "buy":
      send({ t: "buy", itemId: v });
      break;
    case "nextday":
      send({ t: "nextDay" });
      break;
    case "pop":
      el.remove();
      break;
    case "unbait":
      $("#overlay")!.innerHTML = "";
      break;
    case "tutorial":
      showTutorial(0);
      break;
    case "tutnext": {
      const step = Number($(".tut")?.dataset.step ?? 0);
      if (step >= TUTORIAL.length - 1) closeTutorial();
      else showTutorial(step + 1);
      break;
    }
    case "tutprev":
      showTutorial(Math.max(0, Number($(".tut")?.dataset.step ?? 0) - 1));
      break;
    case "tutskip":
      closeTutorial();
      break;
  }
});

stage.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  switch (form.dataset.form) {
    case "join": {
      if (busy) return;
      profile.name = $<HTMLInputElement>("#name")!.value.trim().slice(0, 16);
      saveProfile();
      const code = normalizeCode($<HTMLInputElement>("#code")!.value);
      if (!code) {
        titleError = "Ein Raumcode hat 5 Zeichen (Buchstaben und Zahlen).";
        renderTitleError(titleError);
        return;
      }
      join(code);
      break;
    }
    case "chat": {
      const input = $<HTMLInputElement>("#tc-in")!;
      if (input.value.trim()) send({ t: "chat", text: input.value });
      input.value = "";
      break;
    }
    case "say": {
      const input = $<HTMLInputElement>("#say")!;
      const call = myCall();
      if (!call || call.thinking || !input.value.trim()) return;
      send({ t: "say", callId: call.id, text: input.value });
      input.value = "";
      break;
    }
  }
});

/* ================================================================== */
/* timers                                                             */
/* ================================================================== */

function tickTimers() {
  const t = now();
  stage.querySelectorAll<HTMLElement>("[data-ends]").forEach((el) => (el.textContent = mmss(Number(el.dataset.ends) - t)));
  if (S?.phase === "day") {
    const total = S.daySeconds * 1000;
    const p = Math.min(1, Math.max(0, 1 - (S.dayEndsAt - t) / total));
    const mins = 9 * 60 + Math.floor(p * 8 * 60);
    const clock = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    stage.querySelectorAll<HTMLElement>("[data-clock]").forEach((el) => {
      el.textContent = clock;
      el.title = `noch ${mmss(S!.dayEndsAt - t)}`;
    });
  }
}
setInterval(tickTimers, 250);

render();
wakeServer();
// first visit: the short tour (skippable, never forced again)
if (!tutorialDone()) showTutorial(0);
window.addEventListener("keydown", (e) => {
  const tut = $(".tut");
  if (!tut) return;
  const step = Number(tut.dataset.step ?? 0);
  if (e.key === "Escape") closeTutorial();
  else if (e.key === "ArrowRight") step >= TUTORIAL.length - 1 ? closeTutorial() : showTutorial(step + 1);
  else if (e.key === "ArrowLeft" && step > 0) showTutorial(step - 1);
});

// Toki: "Invite friends" before a room exists opens one; the Toki name fills in the name field
onTokiHost(() => void createAndJoin());
onTokiName((name) => {
  if (nameTouched) return;
  profile.name = name.slice(0, 16);
  saveProfile();
  const field = $<HTMLInputElement>("#name");
  if (field) field.value = profile.name;
});
