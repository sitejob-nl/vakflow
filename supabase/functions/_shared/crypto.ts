// _shared/crypto.ts — Centralized AES-256-GCM encrypt/decrypt + HMAC-SHA256

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Parse the SMTP_ENCRYPTION_KEY env var into exactly 32 bytes.
 * Accepts 64-char hex or 44-char base64. Throws on anything else.
 */
function getKeyBytes(): Uint8Array {
  const raw = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!raw) throw new Error("SMTP_ENCRYPTION_KEY not configured");

  // Try hex (64 hex chars = 32 bytes)
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return hexToBytes(raw);
  }

  // Try base64
  try {
    const bytes = base64ToBytes(raw);
    if (bytes.length === 32) return bytes;
  } catch { /* not valid base64 */ }

  throw new Error(
    "SMTP_ENCRYPTION_KEY must be exactly 32 bytes encoded as 64 hex chars or 44 base64 chars"
  );
}

/** AES-256-GCM encrypt. Returns "base64(iv):base64(ciphertext)" */
export async function encrypt(plainText: string): Promise<string> {
  const keyBytes = getKeyBytes();
  const key = await crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText));
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

/** AES-256-GCM decrypt. Expects "base64(iv):base64(ciphertext)" */
export async function decrypt(encryptedStr: string): Promise<string> {
  const keyBytes = getKeyBytes();
  const key = await crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
  const [ivB64, ctB64] = encryptedStr.split(":");
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ctB64);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext.buffer as ArrayBuffer);
  return new TextDecoder().decode(decrypted);
}

/** HMAC-SHA256 sign a payload. Returns hex string. */
export async function hmacSign(payload: string): Promise<string> {
  const keyBytes = getKeyBytes();
  const key = await crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 verify a payload against a hex signature. */
export async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// Re-export base64ToBytes for consumers that need it
export { base64ToBytes };
