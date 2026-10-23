import type { Enrichment } from "@/lib/plan/enrichment";
import { createRecord, withEnrichment } from "@/lib/plan/record";
import { factsOf, type Brief, type PlanRecord } from "@/lib/plan/schema";

/** Synthetic data only: relation words and places, never real people. */

export const TODAY = "2026-10-21";
export const NOW = "2026-10-21T10:00:00.000Z";

export const weddingBrief: Extract<Brief, { type: "wedding" }> = {
  type: "wedding",
  title: "Winter wedding in Jaipur",
  date: "2027-02-14",
  city: "Jaipur",
  guests: 250,
  budget: 18_00_000,
  style: "traditional",
  food: "veg",
  notes: "Outdoor pheras if the weather allows.",
  functions: ["haldi", "mehndi", "sangeet", "wedding"],
};

export const birthdayBrief: Extract<Brief, { type: "birthday" }> = {
  type: "birthday",
  title: "Dadi turns 80",
  date: "2026-12-05",
  city: "Lucknow",
  guests: 60,
  budget: 1_50_000,
  style: "modern",
  food: "mixed",
  notes: "",
  honoree: "milestone",
};

export const communityBrief: Extract<Brief, { type: "community" }> = {
  type: "community",
  title: "Block C Diwali mela",
  date: "2026-11-07",
  city: "Pune",
  guests: 400,
  budget: 2_00_000,
  style: "eco",
  food: "veg",
  notes: "Society ground, evening only.",
  kind: "festival",
};

export const weddingFacts = factsOf(weddingBrief);
export const birthdayFacts = factsOf(birthdayBrief);

export function recordFor(brief: Brief, patch: Partial<PlanRecord> = {}): PlanRecord {
  return { ...createRecord(brief, "plan-1", NOW), ...patch };
}

export const sampleEnrichment: Enrichment = {
  theme: { name: "Marigold courtyard", summary: "Warm Rajasthani colours with live folk music." },
  ideas: [
    { area: "decor", title: "Marigold canopy", detail: "Strings over the mandap.", cost: "medium" },
    { area: "food", title: "Live jalebi counter", detail: "Near the entrance.", cost: "low" },
  ],
  menu: [{ course: "Mains", dishes: ["Dal baati churma", "Gatte ki sabzi"] }],
  shifts: [{ category: "decor", factor: 1.2, reason: "Outdoor decor needs more flowers." }],
  tasks: [{ title: "Book a tent backup for rain", area: "venue", weeksBefore: 8 }],
  questions: [{ category: "catering", items: ["Is the dal baati made on site?"] }],
  risks: [{ risk: "February evenings get cold.", mitigation: "Keep patio heaters on standby." }],
};

/** A small deterministic PRNG for property-style tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A plan with AI ideas already in it, built the way the app builds it. */
export function readyPlan(
  brief: Brief = weddingBrief,
  patch: Partial<PlanRecord> = {},
): PlanRecord {
  const base = withEnrichment(
    recordFor(brief),
    sampleEnrichment,
    { facts: factsOf(brief), locale: "en" },
    NOW,
  );
  return { ...base, ...patch };
}
