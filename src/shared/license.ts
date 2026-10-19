import { LICENSE_PUBLIC_KEY_SPKI } from "./licensePublicKey";
import { SCREENIX_ORIGIN } from "./screenixOrigin";

export const LICENSE_PRICING_URL = `${SCREENIX_ORIGIN}/chrome/pricing`;
export const LICENSE_DASHBOARD_URL = `${SCREENIX_ORIGIN}/dashboard/licenses`;
export const SHARES_DASHBOARD_URL = `${SCREENIX_ORIGIN}/dashboard/videos`;

const STORAGE_KEY = "license";
const INSTALL_ID_KEY = "installId";
const ACTIVATE_URL = `${SCREENIX_ORIGIN}/api/chrome/license/activate`;
const REFRESH_URL = `${SCREENIX_ORIGIN}/api/chrome/license/refresh`;
const DEACTIVATE_URL = `${SCREENIX_ORIGIN}/api/chrome/license/deactivate`;
const KEY_HINT_LENGTH = 4;
const TOKEN_ISSUER = "api.screenix.app";
const TOKEN_AUDIENCE = "screenix-chrome";
const TOKEN_TYPE = "chrome-license";
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export class LicenseActivationError extends Error {
  constructor(message: string, readonly code: string | null) {
    super(message);
  }
}

export const LICENSE_ALREADY_ACTIVE = "already_active";

export interface License {
  email: string;
  expiresAt: number;
  keyHint: string | null;
}

interface StoredLicense {
  token: string;
  keyHint?: string;
}

interface TokenClaims {
  iss?: string;
  aud?: string | string[];
  type?: string;
  sub?: string;
  email?: string;
  installId?: string;
  exp?: number;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

let publicKeyPromise: Promise<CryptoKey> | null = null;

function publicKey(): Promise<CryptoKey> {
  publicKeyPromise ??= crypto.subtle.importKey(
    "spki",
    Uint8Array.from(atob(LICENSE_PUBLIC_KEY_SPKI), (char) => char.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return publicKeyPromise;
}

export async function installId(): Promise<string> {
  const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
  const existing = stored[INSTALL_ID_KEY] as string | undefined;
  if (existing) return existing;
  const created = crypto.randomUUID();
  await chrome.storage.local.set({ [INSTALL_ID_KEY]: created });
  return created;
}

async function verifiedLicense(token: string, keyHint: string | null): Promise<License | null> {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const signed = new TextEncoder().encode(`${header}.${payload}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", await publicKey(), base64UrlToBytes(signature), signed);
  if (!valid) return null;

  const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as TokenClaims;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== TOKEN_ISSUER || !audiences.includes(TOKEN_AUDIENCE) || claims.type !== TOKEN_TYPE) return null;
  if (!claims.sub || !claims.email || !claims.exp || claims.installId !== (await installId())) return null;
  return { email: claims.email, expiresAt: claims.exp * 1000, keyHint };
}

async function readStoredLicense(): Promise<StoredLicense | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as StoredLicense | undefined) ?? null;
}

export async function readLicense(): Promise<License | null> {
  const stored = await readStoredLicense();
  if (!stored) return null;
  const license = await verifiedLicense(stored.token, stored.keyHint ?? null).catch(() => null);
  return license && Date.now() < license.expiresAt + OFFLINE_GRACE_MS ? license : null;
}

async function storeLicenseToken(token: string, keyHint: string | null): Promise<License> {
  const license = await verifiedLicense(token, keyHint).catch(() => null);
  if (!license) throw new Error("This license token isn't valid.");
  await chrome.storage.local.set({ [STORAGE_KEY]: { token, ...(keyHint ? { keyHint } : {}) } satisfies StoredLicense });
  return license;
}

export async function activateLicenseKey(licenseKey: string): Promise<License> {
  const response = await fetch(ACTIVATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey: licenseKey.trim(), installId: await installId() }),
  }).catch(() => null);
  if (!response) throw new Error("Couldn't reach Screenix. Check your connection and try again.");
  const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string; code?: string };
  if (!response.ok || !body.token) throw new LicenseActivationError(body.error ?? "This license key couldn't be activated.", body.code ?? null);
  return storeLicenseToken(body.token, licenseKey.trim().slice(-KEY_HINT_LENGTH).toUpperCase());
}

export async function deactivateLicense(): Promise<void> {
  const stored = await readStoredLicense();
  if (!stored) return;
  const response = await fetch(DEACTIVATE_URL, { method: "POST", headers: { Authorization: `Bearer ${stored.token}` } }).catch(() => null);
  if (!response) throw new Error("Couldn't reach Screenix. Check your connection and try again.");
  await chrome.storage.local.remove(STORAGE_KEY);
}

let refreshInFlight: Promise<void> | null = null;

export function refreshLicense(): Promise<void> {
  refreshInFlight ??= refreshStoredLicense().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshStoredLicense(): Promise<void> {
  const stored = await readStoredLicense();
  if (!stored) return;
  const response = await fetch(REFRESH_URL, { method: "POST", headers: { Authorization: `Bearer ${stored.token}` } }).catch(() => null);
  if (!response) return;
  if (response.status === 401 || response.status === 403) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return;
  }
  if (!response.ok) return;
  const body = (await response.json()) as { token?: string };
  if (body.token) await storeLicenseToken(body.token, stored.keyHint ?? null).catch(() => undefined);
}

export async function currentLicenseToken(): Promise<string | null> {
  await refreshLicense();
  if (!(await readLicense())) return null;
  return (await readStoredLicense())?.token ?? null;
}

export async function currentLicense(): Promise<License | null> {
  await refreshLicense();
  return readLicense();
}

export function onLicenseChanged(listener: () => void): () => void {
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && STORAGE_KEY in changes) listener();
  };
  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
