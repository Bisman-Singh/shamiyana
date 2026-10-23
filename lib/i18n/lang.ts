import type { Locale } from "@/lib/plan/constants";

const DEVANAGARI = /\p{Script=Devanagari}/u;
const LETTER = /\p{L}/u;

/**
 * The lang attribute for text whose language may not be the page's: AI text
 * stays in the language it was written in until it is made again, and people
 * type titles in either. Hindi here is written in Devanagari, so the script
 * tells the two apart. Undefined when the text matches the page or has no
 * letters, so the page's own lang applies.
 */
export function langOf(text: string, page: Locale): Locale | undefined {
  if (!LETTER.test(text)) return undefined;
  const written: Locale = DEVANAGARI.test(text) ? "hi" : "en";
  return written === page ? undefined : written;
}
