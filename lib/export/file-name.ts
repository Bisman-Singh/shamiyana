/** A file name from a plan title: letters and digits in any script, nothing that changes directory. */
export function fileName(title: string, extension: string): string {
  const slug = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");
  return `${slug === "" ? "plan" : slug}.${extension}`;
}
