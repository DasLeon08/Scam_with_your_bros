/**
 * The player's own OpenAI key, kept on this device only.
 * IndexedDB on purpose: Toki copies localStorage into the player's Toki account to sync saves,
 * and a key must not end up there.
 */
export interface AiSettings {
  key: string;
  model: string;
}

export const DEFAULT_MODEL = "gpt-4o-mini";
export const KEY_RE = /^sk-[A-Za-z0-9_-]{20,200}$/;

const DB = "bros-secrets";
const STORE = "kv";
const ID = "openai";
let memory: AiSettings | null = null; // fallback if IndexedDB is blocked (private mode)

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function loadAiSettings(): Promise<AiSettings | null> {
  try {
    const v = (await run("readonly", (s) => s.get(ID))) as AiSettings | undefined;
    return v && typeof v.key === "string" && KEY_RE.test(v.key) ? { key: v.key, model: v.model || DEFAULT_MODEL } : null;
  } catch {
    return memory;
  }
}

export async function saveAiSettings(v: AiSettings): Promise<void> {
  memory = v;
  try {
    await run("readwrite", (s) => s.put(v, ID));
  } catch {}
}

export async function clearAiSettings(): Promise<void> {
  memory = null;
  try {
    await run("readwrite", (s) => s.delete(ID));
  } catch {}
}

/** sk-proj-…abcd: enough to recognise the key, never the whole key. */
export const maskKey = (key: string) => `${key.slice(0, 8)}…${key.slice(-4)}`;
