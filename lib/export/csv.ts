/**
 * CSV for spreadsheets. A cell that a spreadsheet would run as a formula,
 * one starting with =, +, -, @, tab or carriage return, gets an apostrophe
 * in front, per the OWASP guidance on CSV injection. The file starts with a
 * byte-order mark so spreadsheet apps open Hindi text as UTF-8.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const BOM = String.fromCharCode(0xfeff);

/** One CSV cell, quoted when needed, with formula starts neutralised. */
export function csvCell(value: string | number): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A CSV file with a BOM and CRLF line ends, as spreadsheets expect. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return `${BOM}${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
