import { BASE_SHARES, variantFactors } from "./catalog";
import { LIMITS, type CategoryId, type VendorStatus } from "./constants";
import type { EventFacts, PlanRecord } from "./schema";
import { isSecured } from "./vendors";

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

/** A budget line's weight kept inside its bounds, to two decimals. */
export function clampFactor(value: number): number {
  return Math.round(Math.min(LIMITS.factorMax, Math.max(LIMITS.factorMin, value)) * 100) / 100;
}

/** The plan's categories with their weights after event details and user shifts. */
export function weightsFor(
  brief: EventFacts,
  factors: PlanRecord["factors"],
): (readonly [CategoryId, number])[] {
  const variant = variantFactors(brief);
  const shares = BASE_SHARES[brief.type];
  // Contingency keeps its share however the other lines are tilted.
  const reserve = shares.contingency;
  const raw = Object.entries(shares).map(([key, base]) => {
    const category = key as CategoryId;
    const user = factors[category];
    const weight = base * (variant[category] ?? 1) * (user === undefined ? 1 : clampFactor(user));
    return [category, weight] as const;
  });
  const rest = raw.reduce((acc, [c, w]) => (c === "contingency" ? acc : acc + w), 0);
  return raw.map(([c, w]) => [c, c === "contingency" ? reserve : (w / rest) * (1 - reserve)]);
}

export function planBudget(brief: EventFacts, factors: PlanRecord["factors"]): BudgetLine[] {
  return allocate(brief.budget, weightsFor(brief, factors));
}

/** A line's rupees now and with its shift set to `factor`. */
export type ShiftPreview = (
  category: CategoryId,
  factor: number,
) => { before: number; after: number };

/**
 * Shows a shift in rupees. A shift scales a line's share and the rest make
 * room, so ×1.2 is not exactly 20% more money; the user should see the money.
 */
export function previewShifts(brief: EventFacts, factors: PlanRecord["factors"]): ShiftPreview {
  const amount = (f: PlanRecord["factors"], category: CategoryId) =>
    planBudget(brief, f).find((l) => l.category === category)?.amount ?? 0;
  return (category, factor) => ({
    before: amount(factors, category),
    after: amount({ ...factors, [category]: factor }, category),
  });
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
  brief: EventFacts,
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
  const committed = rows.filter((r) => isSecured(r.status)).reduce((acc, r) => acc + r.quote, 0);
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
