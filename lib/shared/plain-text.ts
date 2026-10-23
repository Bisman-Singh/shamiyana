/**
 * Plain-text hygiene for anything typed by a user or written by the model:
 * C0 and C1 controls, DEL and the bidi override and isolate marks become spaces, so a
 * string can't hide characters or reorder itself on screen, in a CSV or in a
 * calendar file.
 */

// Cc is every C0 and C1 control; the rest are the bidi marks, embeddings, overrides and isolates.
// The joiners U+200C and U+200D stay, since Devanagari needs them.
const CONTROLS = /[^\P{Cc}\n]|[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;
const CONTROLS_AND_NEWLINES = /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/** Text with control and bidi characters replaced, lines trimmed and NFC applied. */
export function cleanText(value: string, keepNewlines = false): string {
  return value
    .normalize("NFC")
    .replace(keepNewlines ? CONTROLS : CONTROLS_AND_NEWLINES, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * A single line of plain text, at most `max` UTF-16 units, cut on a grapheme
 * boundary so a Devanagari conjunct or an emoji is never split.
 */
export function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const flat = cleanText(value).replace(/\s+/g, " ");
  if (flat.length <= max) return flat;
  let out = "";
  for (const { segment } of graphemes.segment(flat)) {
    if (out.length + segment.length > max) break;
    out += segment;
  }
  return out.trimEnd();
}
