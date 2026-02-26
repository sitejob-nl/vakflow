import { useState, useEffect } from "react";
import { getSignedUrl } from "@/utils/storageUtils";

/**
 * Hook that converts a storage URL/path to a signed URL for private buckets.
 */
export function useSignedUrl(bucket: string, urlOrPath: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!urlOrPath) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    getSignedUrl(bucket, urlOrPath).then((url) => {
      if (!cancelled) setSignedUrl(url);
    });
    return () => { cancelled = true; };
  }, [bucket, urlOrPath]);

  return signedUrl;
}
