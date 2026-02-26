import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the storage path from a full Supabase storage URL or return the path as-is.
 * Handles both old public URLs and new path-only storage references.
 */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  // If it's already a relative path (no http), return as-is
  if (!urlOrPath.startsWith("http")) return urlOrPath;

  // Extract path from public URL pattern:
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const publicPattern = `/storage/v1/object/public/${bucket}/`;
  const idx = urlOrPath.indexOf(publicPattern);
  if (idx !== -1) {
    return decodeURIComponent(urlOrPath.slice(idx + publicPattern.length));
  }

  // Fallback: return the URL as-is (shouldn't happen)
  return urlOrPath;
}

/**
 * Create a signed URL for a storage object. Returns the signed URL or null on error.
 * Caches signed URLs for the duration of the session.
 */
const signedUrlCache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(
  bucket: string,
  pathOrUrl: string,
  expiresIn = 3600
): Promise<string | null> {
  const path = extractStoragePath(pathOrUrl, bucket);
  const cacheKey = `${bucket}/${path}`;
  const now = Date.now();

  // Return cached URL if still valid (with 5 min buffer)
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expires > now + 300_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL:", error?.message);
    return null;
  }

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expires: now + expiresIn * 1000,
  });

  return data.signedUrl;
}
