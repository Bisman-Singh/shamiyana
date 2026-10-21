import { BASE_SHARES, variantFactors } from "./catalog";
import type { CategoryId, VendorStatus } from "./constants";
import { ENRICHMENT_LIMITS } from "./enrichment";
import type { Brief, PlanRecord } from "./schema";

export interface BudgetLine {
  category: CategoryId;
  /** Fraction of the total, 0 to 1. */
  share: number;
  amount: number;
}

/**
 * Splits `total` rupees by weight so the parts add up to the total exactly.
 *
 * Amounts are whole multiples of `unit`, ₹100 by default, so a line reads
 * ₹3,60,000 rather than ₹3,60,013. Units are shared out by largest
 * remainder; the few rupees below one unit go to contingency, or to the
 * largest line when the plan has none.
 */
export function allocate(
  total: number,
  weights: readonly (readonly [CategoryId, number])[],
  unit = 100,
): BudgetLine[] {
  const positive = weights.filter(([, w]) => w > 0);
  const sum = positive.reduce((acc, [, w]) => acc + w, 0);
  if (positive.length === 0 || sum === 0 || total <= 0) return [];

  const step = total >= unit * positive.length ? unit : 1;
  const units = Math.floor(total / step);
  const parts = positive.map(([category, w], order) => {
    const raw = (units * w) / sum;
    return { category, share: w / sum, base: Math.floor(raw), frac: raw - Math.floor(raw), order };
  });
  const left = units - parts.reduce((acc, p) => acc + p.base, 0);
  const bonus = new Set(
    [...parts]
      .sort((a, b) => b.frac - a.frac || a.order - b.order)
      .slice(0, left)
      .map((p) => p.order),
  );
  const lines = parts.map((p) => ({
    category: p.category,
    share: p.share,
    amount: (p.base + (bonus.has(p.order) ? 1 : 0)) * step,
  }));
  const rest = total - units * step;
  const sink =
    lines.find((l) => l.category === "contingency") ??
    lines.reduce((max, l) => (l.amount > max.amount ? l : max));
  sink.amount += rest;
  return lines;
}

function clampFactor(value: number): number {
  return Math.min(ENRICHMENT_LIMITS.factorMax, Math.max(ENRICHMENT_LIMITS.factorMin, value));
}

/** The plan's categories with their weights after event details and user shifts. */
export function weightsFor(
  brief: Brief,
  factors: PlanRecord["factors"],
): (readonly [CategoryId, number])[] {
  const variant = variantFactors(brief);
  return Object.entries(BASE_SHARES[brief.type]).map(([key, base]) => {
    const category = key as CategoryId;
    const user = factors[category];
    return [
      category,
      base * (variant[category] ?? 1) * (user === undefined ? 1 : clampFactor(user)),
    ];
  });
}

export function planBudget(brief: Brief, factors: PlanRecord["factors"]): BudgetLine[] {
  return allocate(brief.budget, weightsFor(brief, factors));
}

export interface BudgetRow extends BudgetLine {
  status: VendorStatus;
  quote: number;
  paid: number;
  /** Quote minus plan; positive means over. Zero until there is a quote. */
  variance: number;
}

export interface BudgetSummary {
  rows: BudgetRow[];
  total: number;
  /** Agreed amounts for vendors marked booked or paid. */
  committed: number;
  paid: number;
  /** Total minus committed; negative once bookings exceed the budget. */
  remaining: number;
  /** Catering line divided by the brief's guest count. */
  perGuestCatering: number | null;
  overCategories: CategoryId[];
}

export function summariseBudget(
  lines: readonly BudgetLine[],
  brief: Brief,
  vendors: PlanRecord["vendors"],
): BudgetSummary {
  const rows = lines.map((line) => {
    const progress = vendors[line.category];
    const quote = progress?.quote ?? 0;
    return {
      ...line,
      status: progress?.status ?? "todo",
      quote,
      paid: progress?.paid ?? 0,
      variance: quote > 0 ? quote - line.amount : 0,
    };
  });
  const isCommitted = (r: BudgetRow) => r.status === "booked" || r.status === "paid";
  const committed = rows.filter(isCommitted).reduce((acc, r) => acc + r.quote, 0);
  const catering = lines.find((l) => l.category === "catering");
  return {
    rows,
    total: brief.budget,
    committed,
    paid: rows.reduce((acc, r) => acc + r.paid, 0),
    remaining: brief.budget - committed,
    perGuestCatering: catering ? Math.round(catering.amount / brief.guests) : null,
    overCategories: rows.filter((r) => r.variance > 0).map((r) => r.category),
  };
}
