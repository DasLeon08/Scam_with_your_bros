import { AI_KEY_RE, providerById, type AiAuth } from "@bros/shared";

/**
 * The player's own AI endpoint and key, kept on this device only.
 * IndexedDB on purpose: Toki copies localStorage into the player's Toki account to sync saves,
 * and a key must not end up there.
 */
export interface AiSettings {
  provider: string;
  baseUrl: string;
  auth: AiAuth;
  key: string;
  model: string;
}

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
    const v = (await run("readonly", (s) => s.get(ID))) as Partial<AiSettings> | undefined;
    if (!v || typeof v.key !== "string") return null;
    const p = providerById(v.provider ?? "openai");
    const auth: AiAuth = v.auth === "api-key" || v.auth === "none" ? v.auth : "bearer";
    if (auth !== "none" && !AI_KEY_RE.test(v.key)) return null;
    return { provider: p.id, baseUrl: v.baseUrl || p.baseUrl, auth, key: v.key, model: v.model || p.model };
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
export const maskKey = (key: string) => (key ? `${key.slice(0, Math.min(6, key.length - 4))}…${key.slice(-4)}` : "ohne Key");
