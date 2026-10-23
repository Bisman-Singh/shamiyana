/** Reads a small text file the user picked, refusing anything over `max` bytes. */
export async function readTextFile(file: File, max: number): Promise<string | null> {
  if (file.size > max) return null;
  return await file.text();
}
