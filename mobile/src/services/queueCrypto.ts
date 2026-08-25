/**
 * Authenticated encryption for AsyncStorage offline queues (device-bound).
 * Construction: XOR keystream from SHA-256(key||iv||counter) + SHA-256 MAC.
 * Not a substitute for SQLCipher / hardware-backed DB encryption — see docs/CONTROL_MAPPING.md.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const QUEUE_KEY_NAME = 'bloomcare_queue_crypto_key_v1';
const PREFIX = 'enc:v1:';

async function getQueueKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(QUEUE_KEY_NAME);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(QUEUE_KEY_NAME, key);
  return key;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function utf8Encode(text: string): Uint8Array {
  // Avoid relying on TextEncoder in older RN JSC builds.
  const escaped = encodeURIComponent(text);
  const bytes: number[] = [];
  for (let i = 0; i < escaped.length; i += 1) {
    const c = escaped.charAt(i);
    if (c === '%') {
      bytes.push(Number.parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(c.charCodeAt(0));
    }
  }
  return Uint8Array.from(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  let escaped = '';
  for (let i = 0; i < bytes.length; i += 1) {
    escaped += `%${bytes[i].toString(16).padStart(2, '0')}`;
  }
  return decodeURIComponent(escaped);
}

async function keystreamBlock(key: string, iv: string, counter: number): Promise<Uint8Array> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${key}:${iv}:${counter}`
  );
  return hexToBytes(digest);
}

async function xorCrypt(key: string, iv: string, data: Uint8Array): Promise<Uint8Array> {
  const out = new Uint8Array(data.length);
  let offset = 0;
  let counter = 0;
  while (offset < data.length) {
    const block = await keystreamBlock(key, iv, counter);
    const n = Math.min(block.length, data.length - offset);
    for (let i = 0; i < n; i += 1) {
      out[offset + i] = data[offset + i] ^ block[i];
    }
    offset += n;
    counter += 1;
  }
  return out;
}

async function mac(key: string, message: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${key}\n${message}`);
}

export function isEncryptedBlob(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export async function encryptString(plaintext: string): Promise<string> {
  const key = await getQueueKey();
  const ivBytes = await Crypto.getRandomBytesAsync(16);
  const iv = bytesToHex(ivBytes);
  const cipher = await xorCrypt(key, iv, utf8Encode(plaintext));
  const ct = bytesToHex(cipher);
  const tag = await mac(key, `${iv}:${ct}`);
  return `${PREFIX}${iv}:${ct}:${tag}`;
}

export async function decryptString(blob: string): Promise<string> {
  if (!isEncryptedBlob(blob)) {
    return blob;
  }
  const key = await getQueueKey();
  const body = blob.slice(PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted queue blob');
  }
  const [iv, ct, tag] = parts;
  const expected = await mac(key, `${iv}:${ct}`);
  if (expected !== tag) {
    throw new Error('Queue integrity check failed');
  }
  const plain = await xorCrypt(key, iv, hexToBytes(ct));
  return utf8Decode(plain);
}

/**
 * Read AsyncStorage value; decrypt if enc:v1, else treat as legacy plaintext.
 */
export async function readSecureJsonArray<T>(
  storageKey: string,
  getItem: (key: string) => Promise<string | null>,
  setItem: (key: string, value: string) => Promise<void>
): Promise<T[]> {
  const raw = await getItem(storageKey);
  if (!raw) return [];
  try {
    const json = isEncryptedBlob(raw) ? await decryptString(raw) : raw;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];

    // Migrate plaintext → encrypted on first successful read.
    if (!isEncryptedBlob(raw)) {
      const sealed = await encryptString(json);
      await setItem(storageKey, sealed);
    }
    return parsed as T[];
  } catch {
    return [];
  }
}

export async function writeSecureJsonArray<T>(
  storageKey: string,
  value: T[],
  setItem: (key: string, value: string) => Promise<void>
): Promise<void> {
  const sealed = await encryptString(JSON.stringify(value));
  await setItem(storageKey, sealed);
}
