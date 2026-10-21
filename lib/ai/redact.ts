/**
 * Strips contact and identity numbers from free text before it is sent to
 * the model. The form asks for none of these, but people paste them into
 * notes; the model doesn't need them to plan a party.
 */

const PATTERNS: readonly RegExp[] = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /(?:\+?91[\s-]?)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/g,
  /(?<!\d)\d{10,}(?!\d)/g,
];

export const REDACTED = "[removed]";

export function redact(text: string): string {
  return PATTERNS.reduce((acc, pattern) => acc.replace(pattern, REDACTED), text);
}
