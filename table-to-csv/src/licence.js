/**
 * Licence checking, offline.
 *
 * Paddle issues a licence key at checkout and signs it. Verifying that
 * signature in the extension with the embedded public key means there is no
 * server to run, nothing to pay for, and nothing to break when it goes down.
 *
 * The free tier is deliberately usable on its own: one table per page, CSV
 * only. Anything that makes a tedious job bulk — every table at once, TSV,
 * JSON, Markdown — is what the paid tier is for.
 */

const FREE_LIMITS = {
  tablesPerPage: 1,
  formats: ["csv"],
  exportAll: false,
};

const PRO_LIMITS = {
  tablesPerPage: Infinity,
  formats: ["csv", "tsv", "json", "markdown"],
  exportAll: true,
};

// Replace with the public key from your Paddle dashboard before publishing.
const PADDLE_PUBLIC_KEY = "";

async function verifyKey(key) {
  const trimmed = (key || "").trim();
  if (!trimmed) return false;
  // Format check first: cheap, and catches typos before any crypto work.
  if (!/^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_+/=-]{16,}$/.test(trimmed)) return false;
  if (!PADDLE_PUBLIC_KEY) {
    // No key configured yet: accept nothing rather than accept everything.
    return false;
  }
  try {
    const [payload, signature] = trimmed.split(".");
    const pub = await crypto.subtle.importKey(
      "spki", Uint8Array.from(atob(PADDLE_PUBLIC_KEY), c => c.charCodeAt(0)),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", pub,
      Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)),
      new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

async function getLimits() {
  const { licenceKey, licenceValid } = await chrome.storage.sync.get(
    { licenceKey: "", licenceValid: false });
  if (licenceValid && licenceKey) return { ...PRO_LIMITS, pro: true };
  return { ...FREE_LIMITS, pro: false };
}

async function activate(key) {
  const valid = await verifyKey(key);
  await chrome.storage.sync.set({ licenceKey: valid ? key.trim() : "", licenceValid: valid });
  return valid;
}
