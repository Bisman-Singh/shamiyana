import type { BudgetLine } from "./budget";
import { VENDOR_SEARCH } from "./catalog";
import type { CategoryId, VendorStatus } from "./constants";
import type { PlanRecord, VendorProgress } from "./schema";

export interface VendorCard {
  category: CategoryId;
  planned: number;
  progress: VendorProgress;
  /** Extra questions the AI suggested for this kind of vendor. */
  aiQuestions: string[];
  /** Search phrase for finding this kind of vendor near the event city. */
  search: string;
}

/** Plain phrases for a category an event type doesn't usually hire for. */
const FALLBACK_SEARCH: Record<CategoryId, string> = {
  venue: "event venues",
  catering: "caterers",
  cake: "cake shops",
  decor: "event decorators",
  photo: "event photographers",
  attire: "ethnic wear",
  beauty: "makeup artists",
  entertainment: "event entertainers",
  invitations: "printing shops",
  rituals: "pandit services",
  transport: "car rental",
  stay: "hotels",
  gifts: "gift shops",
  permits: "police station",
  publicity: "flex printing",
  sanitation: "waste management services",
  contingency: "event planners",
};

export const EMPTY_PROGRESS: VendorProgress = { status: "todo", quote: 0, paid: 0, note: "" };

/** One card per budget line that is paid to someone; contingency is not a vendor. */
export function buildVendors(record: PlanRecord, lines: readonly BudgetLine[]): VendorCard[] {
  const questions = new Map<CategoryId, string[]>();
  for (const group of record.enrichment?.questions ?? []) {
    questions.set(group.category, [...(questions.get(group.category) ?? []), ...group.items]);
  }
  return lines
    .filter((line) => line.category !== "contingency")
    .map((line) => ({
      category: line.category,
      planned: line.amount,
      progress: record.vendors[line.category] ?? EMPTY_PROGRESS,
      aiQuestions: questions.get(line.category) ?? [],
      search: VENDOR_SEARCH[record.brief.type][line.category] ?? FALLBACK_SEARCH[line.category],
    }));
}

/** How many vendors are at each status. */
export function vendorTally(cards: readonly VendorCard[]): Record<VendorStatus, number> {
  const tally: Record<VendorStatus, number> = { todo: 0, shortlisted: 0, booked: 0, paid: 0 };
  for (const card of cards) tally[card.progress.status] += 1;
  return tally;
}
