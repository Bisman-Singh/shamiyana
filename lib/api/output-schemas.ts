import { z } from "zod";
import { CHANGE_OPS } from "@/lib/plan/changes";
import { CATEGORY_IDS, IDEA_AREAS, IDEA_COSTS, LIMITS, TASK_AREAS } from "@/lib/plan/constants";

/**
 * Response schemas sent to Gemini as structured-output contracts. They are
 * deliberately loose on lengths and ranges, because a model that overshoots
 * a limit shouldn't lose the whole answer; `sanitizeEnrichment`,
 * `parseChanges` and `sanitizeVision` enforce the real bounds afterwards.
 */

const changeAreas = [
  ...TASK_AREAS,
  ...IDEA_AREAS.filter((area) => !TASK_AREAS.some((taskArea) => taskArea === area)),
];
const factorRange = `${String(LIMITS.factorMin)} to ${String(LIMITS.factorMax)}`;

export const enrichmentOutputSchema = z.object({
  theme: z.object({
    name: z.string().describe("A short evocative theme name, under 6 words."),
    summary: z.string().describe("Two sentences on the look, feel and flow of the event."),
  }),
  ideas: z
    .array(
      z.object({
        area: z.enum(IDEA_AREAS),
        title: z.string().describe("Under 8 words."),
        detail: z.string().describe("One or two practical sentences."),
        cost: z.enum(IDEA_COSTS),
      }),
    )
    .describe("Six to eight personalised ideas across different areas."),
  menu: z
    .array(z.object({ course: z.string(), dishes: z.array(z.string()) }))
    .describe("Three to five courses that respect the food preference."),
  shifts: z
    .array(
      z.object({
        category: z.enum(CATEGORY_IDS),
        factor: z.number().describe(`Multiplier from ${factorRange} on this category's share.`),
        reason: z.string().describe("One sentence tied to this event's details."),
      }),
    )
    .describe("At most four budget shifts, only where the details justify one."),
  tasks: z
    .array(
      z.object({
        title: z.string().describe("An imperative task, under 12 words."),
        area: z.enum(TASK_AREAS),
        weeksBefore: z
          .number()
          .int()
          .describe(`Whole weeks before the event, 0 to ${String(LIMITS.weeksMax)}.`),
      }),
    )
    .describe("Up to five tasks specific to this event that a standard checklist would miss."),
  questions: z
    .array(z.object({ category: z.enum(CATEGORY_IDS), items: z.array(z.string()) }))
    .describe("Up to two sharp questions to ask each of four key vendors."),
  risks: z
    .array(z.object({ risk: z.string(), mitigation: z.string() }))
    .describe("Up to three real risks for this date, place and size, each with a mitigation."),
});

export const refineOutputSchema = z.object({
  reply: z.string().describe("A short, friendly answer in two or three sentences."),
  changes: z
    .array(
      z.object({
        op: z.enum(CHANGE_OPS),
        amount: z.number().int().optional().describe("set_budget: new total in rupees."),
        count: z.number().int().optional().describe("set_guests: new guest count."),
        date: z.string().optional().describe("set_date: YYYY-MM-DD."),
        category: z.enum(CATEGORY_IDS).optional().describe("shift_category: which line."),
        factor: z.number().optional().describe(`shift_category: ${factorRange}.`),
        title: z.string().optional().describe("add_task or add_idea: the title."),
        detail: z.string().optional().describe("add_idea: one sentence."),
        area: z.enum(changeAreas).optional().describe("Task area or idea area."),
        weeksBefore: z.number().int().optional().describe("add_task: weeks before the event."),
      }),
    )
    .describe("Proposed plan changes. Empty when the user only asked a question."),
});

export const VISION_KINDS = ["venue", "decor", "invitation", "outfit", "other"] as const;

export const visionOutputSchema = z.object({
  kind: z.enum(VISION_KINDS).describe("What the photo mainly shows."),
  mood: z.string().describe("One sentence on the mood the photo sets."),
  palette: z
    .array(z.object({ name: z.string(), hex: z.string().describe("#RRGGBB") }))
    .describe("Three to five dominant colours."),
  ideas: z
    .array(z.object({ area: z.enum(IDEA_AREAS), title: z.string(), detail: z.string() }))
    .describe("Three to five ideas for this event inspired by the photo."),
  notes: z
    .array(z.string())
    .describe("Up to three practical observations, such as space, light or crowd flow."),
});
