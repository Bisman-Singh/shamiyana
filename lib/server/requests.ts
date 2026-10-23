import "server-only";

/** The page sends a JPEG redrawn to at most 1600 px, well under this. */
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** The real image type from its first bytes; the declared type is never trusted. */
export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const byteAt = (index: number) => bytes[index] ?? -1;
  if (byteAt(0) === 0xff && byteAt(1) === 0xd8 && byteAt(2) === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((expected, index) => byteAt(index) === expected)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
