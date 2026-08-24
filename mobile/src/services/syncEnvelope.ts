/**
 * Device-bound integrity for offline sync payloads.
 * Uses a keyed SHA-256 MAC (not server-verified — demos stay compatible).
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DEVICE_KEY_NAME = 'bloomcare_sync_mac_key_v1';

export type SignedEnvelope<T = unknown> = {
  v: 1;
  alg: 'sha256-mac';
  ts: string;
  payload: T;
  sig: string;
};

function isEnvelope(value: unknown): value is SignedEnvelope {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj.v === 1 && obj.alg === 'sha256-mac' && typeof obj.sig === 'string' && 'payload' in obj;
}

async function getDeviceMacKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY_NAME);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(DEVICE_KEY_NAME, key);
  return key;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

async function mac(key: string, message: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${key}\n${message}`);
}

export async function signPayload<T>(payload: T): Promise<SignedEnvelope<T>> {
  const key = await getDeviceMacKey();
  const ts = new Date().toISOString();
  const body = `${ts}\n${stableStringify(payload)}`;
  const sig = await mac(key, body);
  return { v: 1, alg: 'sha256-mac', ts, payload, sig };
}

export async function verifyEnvelope<T>(envelope: SignedEnvelope<T>): Promise<boolean> {
  try {
    const key = await getDeviceMacKey();
    const body = `${envelope.ts}\n${stableStringify(envelope.payload)}`;
    const expected = await mac(key, body);
    return expected === envelope.sig;
  } catch {
    return false;
  }
}

/**
 * Serialize payload for SQLite pending_syncs (signed envelope JSON).
 */
export async function serializeSyncPayload(payload: unknown): Promise<string> {
  const envelope = await signPayload(payload);
  return JSON.stringify(envelope);
}

/**
 * Parse stored payload_json. Accepts legacy plaintext JSON or signed envelopes.
 * Returns null if a signed envelope fails verification.
 */
export async function parseSyncPayload<T = unknown>(
  raw: string | null | undefined
): Promise<{ payload: T; signed: boolean } | null> {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isEnvelope(parsed)) {
      const ok = await verifyEnvelope(parsed);
      if (!ok) return null;
      return { payload: parsed.payload as T, signed: true };
    }
    return { payload: parsed as T, signed: false };
  } catch {
    return null;
  }
}
