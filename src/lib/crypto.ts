// Passcode-based encryption using the browser's built-in Web Crypto API.
// PBKDF2 (SHA-256) turns the passcode into an AES-GCM key. Nothing secret is stored in plain text.

export const PBKDF2_ITERATIONS = 210_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(passcode: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface Sealed {
  iv: string;
  data: string;
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), data: toB64(new Uint8Array(cipher)) };
}

/** Throws if the key is wrong or the data was tampered with (AES-GCM authenticates). */
export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv) as BufferSource },
    key,
    fromB64(sealed.data) as BufferSource,
  );
  return JSON.parse(dec.decode(plain)) as T;
}

export function validPasscode(p: string): string | null {
  if (p.length < 6) return 'Use at least 6 characters.';
  if (p.length > 64) return 'Use 64 characters or fewer.';
  if (/^(\d)\1+$/.test(p)) return 'Avoid repeating the same digit.';
  if (['123456', '654321', '012345', 'password', 'qwerty'].includes(p.toLowerCase())) return 'That passcode is too easy to guess.';
  return null;
}
