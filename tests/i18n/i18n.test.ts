import { TASK_IDS } from "@/lib/plan/task-templates";
import { CATEGORY_IDS } from "@/lib/plan/constants";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";
import { getDictionary, isLocale, resolveLocale } from "@/lib/i18n";
import {
  amountInWords,
  format,
  formatDate,
  formatMoney,
  formatNumber,
  intlLocale,
  plural,
} from "@/lib/i18n/format";

function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, path ? `${path}.${k}` : k),
  );
}

describe("dictionaries", () => {
  it("cover every template task and category in both languages", () => {
    for (const id of TASK_IDS) {
      expect(en.tasks).toHaveProperty(id);
      expect(hi.tasks).toHaveProperty(id);
    }
    for (const id of CATEGORY_IDS) {
      expect(en.categories[id]).toBeTruthy();
      expect(hi.categories[id]).toBeTruthy();
      expect(Array.isArray(en.vendors.questions[id])).toBe(true);
    }
  });

  it("have the same keys in both languages", () => {
    const keys = (dict: unknown) =>
      [...new Set(leaves(dict).map(([path]) => path.replace(/\[\d+\]/g, "[]")))].sort((a, b) =>
        a.localeCompare(b),
      );
    expect(keys(hi)).toEqual(keys(en));
  });

  it("use the same placeholders in Hindi as in English", () => {
    const hiMap = new Map(leaves(hi));
    for (const [path, text] of leaves(en)) {
      const names = (s: string) =>
        [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort((a, b) => a.localeCompare(b));
      expect(names(hiMap.get(path) ?? ""), path).toEqual(names(text));
    }
  });

  it("have no empty strings, em dashes or leftover English in Hindi task text", () => {
    for (const [path, text] of [...leaves(en), ...leaves(hi)]) {
      expect(text.trim(), path).not.toBe("");
      expect(text, path).not.toContain("—");
    }
    for (const text of Object.values(hi.tasks)) expect(text).toMatch(/[ऀ-ॿ]/);
  });
});

describe("locale resolution", () => {
  it("prefers the cookie, then the browser, then English", () => {
    expect(resolveLocale("hi", "en-US")).toBe("hi");
    expect(resolveLocale(undefined, "hi-IN,en;q=0.8")).toBe("hi");
    expect(resolveLocale("fr", "en-GB")).toBe("en");
    expect(resolveLocale(undefined, null)).toBe("en");
    expect(isLocale("en")).toBe(true);
    expect(isLocale(3)).toBe(false);
    expect(getDictionary("hi")).toBe(hi);
    expect(intlLocale("hi")).toBe("hi-IN");
  });
});

describe("formatting", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(format("{a} of {b}", { a: 1, b: "two" })).toBe("1 of two");
    expect(format("{missing}")).toBe("{missing}");
  });

  it("picks plural forms by language rules", () => {
    expect(plural("en", en.workspace.daysToGo, 1)).toBe("1 day to go");
    expect(plural("en", en.workspace.daysToGo, 1200)).toBe("1,200 days to go");
    expect(plural("hi", hi.workspace.daysToGo, 0)).toBe("0 दिन बाक़ी");
  });

  it("formats rupees and numbers the Indian way", () => {
    expect(formatMoney(1800000, "en")).toBe("₹18,00,000");
    expect(formatMoney(1800000, "hi")).toBe("₹18,00,000");
    expect(formatNumber(250000, "en")).toBe("2,50,000");
  });

  it("formats calendar dates without a time-zone shift", () => {
    expect(formatDate("2027-02-14", "en")).toBe("14 Feb 2027");
    expect(formatDate("2027-02-14", "en", true)).toBe("Sunday, 14 February 2027");
    expect(formatDate("2027-02-14", "hi")).toContain("2027");
  });

  it("says amounts in thousands, lakhs and crores", () => {
    expect(amountInWords(1800000, en, "en")).toBe("18 lakh");
    expect(amountInWords(12500000, en, "en")).toBe("1.25 crore");
    expect(amountInWords(75000, en, "en")).toBe("75 thousand");
    expect(amountInWords(500, en, "en")).toBe("₹500");
    expect(amountInWords(150000, hi, "hi")).toBe("1.5 लाख");
  });
});
