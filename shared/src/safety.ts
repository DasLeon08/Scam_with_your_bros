/**
 * Text safety for everything players type and everything the callers say:
 * no links, no e-mail addresses, no phone/card-like numbers and nothing that
 * looks like a voucher or key code that could be redeemed outside the game.
 * Real brand / bank names are swapped for a fantasy name.
 */
export const BLOCKED = "[🚫]";
export const FANTASY_COMPANY = "Fantasie-Firma";

const TLDS =
  "com|net|org|ch|de|at|li|io|gg|app|dev|me|ly|xyz|info|biz|co|uk|eu|tv|link|site|online|shop|store|ru|cn|be|fr|it|nl|us|to|cc|ws|gl|gd|su|top|club|live|pro|page|art|fun";

const RULES: [RegExp, (m: string) => string][] = [
  // e-mail
  [/[^\s@]+@[^\s@]+\.[^\s@]+/g, () => BLOCKED],
  // explicit links
  [/\b(?:https?|ftp):\/\/\S+/gi, () => BLOCKED],
  [/\bwww\.\S+/gi, () => BLOCKED],
  // bare domains like example.com/path
  [new RegExp(`\\b[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})\\b(?:\\/\\S*)?`, "gi"), () => BLOCKED],
  // dashed code groups like ABCD-1234-EFGH (need a digit somewhere)
  [/\b[A-Z0-9]{3,6}(?:-[A-Z0-9]{3,6}){2,}\b/gi, (m) => (/\d/.test(m) ? BLOCKED : m)],
  // long tokens mixing letters and digits (keys, vouchers)
  [/\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{8,}\b/g, () => BLOCKED],
  // long digit runs (phone, card, account numbers)
  [/\d(?:[\d\s./-]{6,})\d/g, (m) => (m.replace(/\D/g, "").length >= 7 ? BLOCKED : m)],
];

/** Real companies, banks, shops and payment services the game never names. */
const BRANDS = [
  // (common words like "Post", "Coop" or "ups" are left out on purpose)
  "paypal", "amazon", "apple", "itunes", "google", "microsoft", "facebook", "instagram",
  "tiktok", "whatsapp", "netflix", "spotify", "steam", "playstation", "xbox", "nintendo", "ebay", "visa",
  "mastercard", "american express", "amex", "western union", "moneygram", "twint", "revolut", "klarna",
  "sparkasse", "volksbank", "commerzbank", "deutsche bank", "postbank", "ubs", "credit suisse",
  "postfinance", "raiffeisen", "erste bank", "bitcoin", "ethereum", "binance", "coinbase", "telekom",
  "swisscom", "vodafone", "dhl", "fedex", "zalando", "aldi", "lidl", "migros",
];
const BRAND_RE = new RegExp(`\\b(?:${BRANDS.map((b) => b.replace(/ /g, "\\s+")).join("|")})\\b`, "gi");

export interface Sanitized {
  text: string;
  removed: boolean;
}

export function sanitizeText(input: unknown, max = 200): Sanitized {
  let text = typeof input === "string" ? input : "";
  // control characters and zero-width tricks out, whitespace collapsed
  text = text.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, " ");
  text = text.replace(/\s+/g, " ").trim().slice(0, max);
  const before = text;
  for (const [re, fn] of RULES) text = text.replace(re, fn);
  text = text.replace(BRAND_RE, FANTASY_COMPANY);
  return { text, removed: text !== before };
}

/** Names: short, no blocked content, never empty. */
export function sanitizeName(input: unknown): string {
  const { text } = sanitizeText(input, 16);
  const clean = text.replace(/\[🚫\]/g, "").trim();
  return clean || "Bro";
}
