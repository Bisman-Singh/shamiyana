/**
 * Strips contact and identity numbers from free text before it is sent to
 * the model. The form asks for none of these, but people paste them into
 * notes; the model doesn't need them to plan a party. Digits in Indian
 * scripts are read as digits first, so a number typed in Devanagari is caught
 * too. This covers the common formats, not every way a number can be written.
 */

/** The code point of zero in each Indian script, plus full-width digits. */
const ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10];

function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (digit) => {
    const code = digit.charCodeAt(0);
    const zero = ZEROS.find((start) => code >= start && code <= start + 9);
    return zero === undefined ? digit : String(code - zero);
  });
}

const PATTERNS: readonly RegExp[] = [
  /[\w.+-]{1,254}@[\w-]{1,63}(?:\.[\w-]{1,63}){1,10}/g,
  // a UPI ID, such as name@oksbi, after emails have gone
  /[\w.-]{2,256}@[a-z]{2,64}\b/gi,
  // GSTIN, which holds a PAN, so it goes first
  /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/gi,
  // PAN
  /\b[A-Z]{5}\d{4}[A-Z]\b/gi,
  // voter ID, then passport
  /\b[A-Z]{3}\d{7}\b/gi,
  /\b[A-Z]\d{7}\b/gi,
  // a card number of 13 to 19 digits in any grouping, before the 12-digit Aadhaar
  /(?<!\d)(?:\d[\s-]?){12,18}\d(?!\d)/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /(?<!\d)(?:\+?91[\s-]?|0)?[6-9](?:[\s-]?\d){9}(?!\d)/g,
  /(?<!\d)0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{4}(?!\d)/g,
  /(?<!\d)\d{10,}(?!\d)/g,
];

export const REDACTED = "[removed]";

/** Removes email addresses, UPI IDs, phone, card and ID numbers in their common formats. */
export function redact(text: string): string {
  return PATTERNS.reduce((acc, pattern) => acc.replace(pattern, REDACTED), asciiDigits(text));
}
