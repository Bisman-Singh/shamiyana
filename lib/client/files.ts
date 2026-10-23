import { toCsv } from "@/lib/export/csv";
import { fileName } from "@/lib/export/links";

/** Saves text as a file through a temporary object URL. */
export function downloadText(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Saves rows as a UTF-8 CSV named after the plan, such as `diwali-mela.budget.csv`. */
export function downloadCsv(
  title: string,
  kind: string,
  rows: readonly (readonly (string | number)[])[],
): void {
  downloadText(fileName(title, `${kind}.csv`), "text/csv;charset=utf-8", toCsv(rows));
}

export const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIDE = 1600;

/** A file that is not one of the photo types the app takes. */
export class UnsupportedImageError extends Error {
  override name = "UnsupportedImageError";
}

/**
 * Redraws a photo onto a canvas, at most 1600px on its longer side, and
 * re-encodes it as JPEG. Uploads get smaller and faster, and the EXIF block
 * with camera, time and GPS location is dropped because a canvas never
 * copies it.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED_IMAGES.some((t) => t === file.type)) throw new UnsupportedImageError(file.type);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("encode"));
      },
      "image/jpeg",
      0.85,
    );
  });
}

/** Reads a small text file the user picked, refusing anything over `max` bytes. */
export async function readTextFile(file: File, max: number): Promise<string | null> {
  if (file.size > max) return null;
  return await file.text();
}
