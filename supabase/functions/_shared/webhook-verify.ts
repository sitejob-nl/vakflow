// _shared/webhook-verify.ts — Meta/WhatsApp webhook signature verificatie

/**
 * Verifieert de X-Hub-Signature-256 header van Meta webhook events.
 * Meta stuurt een HMAC-SHA256 signature mee bij elke POST.
 *
 * @param rawBody - De ruwe request body als string
 * @param signatureHeader - De X-Hub-Signature-256 header waarde (format: "sha256=...")
 * @param appSecret - Je Meta App Secret
 * @returns true als de signature klopt
 */
export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7); // strip "sha256="

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );

  const computedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison
  if (computedHex.length !== expectedSignature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Verifieert de Meta webhook verification challenge (GET request).
 */
export function verifyWebhookChallenge(
  url: URL,
  expectedToken: string
): Response | null {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe") return null;

  if (token === expectedToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}