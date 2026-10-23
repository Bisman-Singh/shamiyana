/** The photo types the app takes; the server checks the real type again by its bytes. */
export const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIDE = 1600;

/** A file that is not one of the photo types the app takes. */
export class UnsupportedImageError extends Error {
  override name = "UnsupportedImageError";
}

/** A photo the browser could not redraw or re-encode. */
export class ImageEncodeError extends Error {
  override name = "ImageEncodeError";
}

/**
 * Redraws a photo onto a canvas, at most 1600px on its longer side, and
 * re-encodes it as JPEG. Uploads get smaller and faster, and the EXIF block
 * with camera, time and GPS location is dropped because a canvas never
 * copies it.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED_IMAGES.some((type) => type === file.type)) {
    throw new UnsupportedImageError(file.type);
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new ImageEncodeError("canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageEncodeError("encode"));
      },
      "image/jpeg",
      0.85,
    );
  });
}
