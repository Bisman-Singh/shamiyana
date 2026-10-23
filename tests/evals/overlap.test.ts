import { en } from "@/lib/i18n/en";
import { EVENT_TYPES } from "@/lib/plan/constants";
import { TASKS } from "@/lib/plan/task-templates";
import { contentWords, isRewording, rewordings } from "@/evals/overlap";

const title = (id: string) => (en.tasks as Record<string, string>)[id] ?? id;

describe("rewording check", () => {
  it("reduces titles to content words", () => {
    expect([...contentWords("Book the photographer and videographer")]).toEqual(["photo", "video"]);
  });

  it("flags rewordings of checklist items", () => {
    const pairs: [string, string][] = [
      ["Hire a photographer and videographer for all functions", "w_book_photo"],
      ["Share the final guest count with the caterer", "w_final_count"],
      ["Book a makeup artist for the bride", "w_book_makeup"],
      ["Reconfirm all vendors with their timings and contact numbers", "w_reconfirm"],
      ["Arrange enough toilets and drinking water", "c_toilets_water"],
    ];
    for (const [task, id] of pairs) {
      expect({ task, flagged: isRewording(task, title(id)) }).toEqual({ task, flagged: true });
    }
  });

  it("lets new, specific tasks through", () => {
    const fresh = [
      "Arrange a cake tasting",
      "Book a tent backup for rain",
      "Print a guest map",
      "Check the evening weather forecast for a sudden winter chill",
      "Inspect perimeter lighting so no corner is dark",
      "Brief volunteers on crowd management near the food stalls",
      "Book heaters for the open-air dinner",
    ];
    const all = Object.values(en.tasks);
    expect(rewordings(fresh, all)).toEqual([]);
  });

  it("never mistakes one checklist item for another", () => {
    for (const type of EVENT_TYPES) {
      const items = TASKS[type].map((t) => title(t.id));
      const clashes = items.flatMap((a, i) =>
        items
          .slice(i + 1)
          .filter((b) => isRewording(a, b))
          .map((b) => [a, b]),
      );
      expect(clashes).toEqual([]);
    }
  });
});
