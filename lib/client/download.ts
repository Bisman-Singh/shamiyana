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
