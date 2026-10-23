import { LIMITS } from "./constants";

/** Digits from typed text: "₹18,00,000" and "18 00 000" both read as 1800000. */
export function readAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (digits === "" || digits.length > 12) return null;
  return Number(digits);
}

/** Besides digits, a typed amount may hold spaces, commas and the rupee sign. */
const AMOUNT_TEXT = /^[\d\s,₹]*$/;

/**
 * A vendor price or payment as typed: 0 while it has no digits yet, and null
 * when it holds anything else or is more than the largest budget, so the
 * field can say what to fix instead of saving a wrong number.
 */
export function readRupees(text: string): number | null {
  if (!AMOUNT_TEXT.test(text)) return null;
  if (!/\d/.test(text)) return 0;
  const amount = readAmount(text);
  return amount !== null && amount <= LIMITS.budgetMax ? amount : null;
}
