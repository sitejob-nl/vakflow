/**
 * Shared helper for fetching a company logo and preparing it for PDF embedding.
 * Only supports JPEG format (most common for logos).
 * Returns null for PNG or other formats — caller should fall back to text.
 */

export interface LogoData {
  /** Hex-encoded JPEG bytes followed by '>' for ASCIIHexDecode */
  hexStream: string;
  /** Original pixel width */
  width: number;
  /** Original pixel height */
  height: number;
  /** Length of hexStream in bytes (for PDF /Length) */
  streamLength: number;
  /** Color space: "DeviceRGB" or "DeviceGray" */
  colorSpace: string;
}

/**
 * Fetch a JPEG logo from a URL and return data ready for PDF embedding.
 * Returns null if the URL is unreachable, not a JPEG, or dimensions can't be parsed.
 */
export async function fetchJpegLogo(url: string): Promise<LogoData | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());

    // Check JPEG magic bytes (FF D8)
    if (bytes.length < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

    // Find SOF0/SOF1/SOF2 marker to get dimensions + component count
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xc2) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        const components = bytes[i + 9];
        if (width === 0 || height === 0) return null;

        const colorSpace = components === 1 ? "DeviceGray" : "DeviceRGB";

        // Convert to hex string for ASCIIHexDecode
        const hexChars = "0123456789abcdef";
        let hex = "";
        for (let j = 0; j < bytes.length; j++) {
          hex += hexChars[bytes[j] >> 4] + hexChars[bytes[j] & 0xf];
        }
        hex += ">"; // ASCIIHexDecode end marker

        return { hexStream: hex, width, height, streamLength: hex.length, colorSpace };
      }
      if (marker === 0xda) break; // Start of scan — no SOF found before SOS
      if (marker === 0xd9) break; // End of image
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate display dimensions for a logo to fit within maxW x maxH while preserving aspect ratio.
 */
export function logoDisplaySize(
  logo: LogoData,
  maxW = 140,
  maxH = 45,
): { dw: number; dh: number } {
  const scale = Math.min(maxW / logo.width, maxH / logo.height);
  return {
    dw: Math.round(logo.width * scale),
    dh: Math.round(logo.height * scale),
  };
}
