import { LIMITS } from "@/lib/plan/constants";
import {
  EMPTY_STORE,
  activePlan,
  canAddPlan,
  parseBackup,
  putPlan,
  removePlan,
  savePlan,
  selectPlan,
} from "@/lib/plan/plans";
import { recordFor, sampleEnrichment, weddingBrief } from "@/tests/helpers/fixtures";

describe("plans", () => {
  const plan = recordFor(weddingBrief);

  it("adds, replaces, selects and removes plans", () => {
    const other = recordFor(weddingBrief, { id: "other" });
    let data = putPlan(EMPTY_STORE, plan);
    data = putPlan(data, other);
    expect(activePlan(data)?.id).toBe("other");
    data = putPlan(data, { ...plan, brief: { ...plan.brief, guests: 10 } });
    expect(data.plans).toHaveLength(2);
    expect(activePlan(data)?.brief.guests).toBe(10);
    expect(selectPlan(data, "missing").activeId).toBeNull();
    expect(selectPlan(data, null).activeId).toBeNull();
    expect(removePlan(data, plan.id).activeId).toBe("other");
    expect(removePlan(data, "other").activeId).toBe(plan.id);
    expect(removePlan(removePlan(data, "other"), plan.id).activeId).toBeNull();
    expect(activePlan(EMPTY_STORE)).toBeNull();
    expect(savePlan(data, { ...other, hidden: ["x"] }).plans[1]?.hidden).toEqual(["x"]);
    expect(savePlan(data, recordFor(weddingBrief, { id: "ghost" })).plans).toEqual(data.plans);
  });

  it("checks backups and room for them", () => {
    const fullStore = {
      ...EMPTY_STORE,
      plans: Array.from({ length: LIMITS.plansMax }, (_, index) =>
        recordFor(weddingBrief, { id: `p${index}` }),
      ),
    };
    expect(canAddPlan(fullStore)).toBe(false);
    expect(parseBackup(JSON.stringify(plan), EMPTY_STORE)).toEqual({ ok: true, record: plan });
    expect(parseBackup(JSON.stringify(plan), fullStore)).toEqual({ ok: false, reason: "full" });
    expect(parseBackup(JSON.stringify({ ...plan, id: "p3" }), fullStore).ok).toBe(true);
    const tricky = recordFor(weddingBrief, {
      enrichment: {
        ...sampleEnrichment,
        risks: [{ risk: "Rain\u2066", mitigation: "Tent\u0007" }],
      },
    });
    const restored = parseBackup(JSON.stringify(tricky), EMPTY_STORE);
    expect(restored.ok && restored.record.enrichment?.risks).toEqual([
      { risk: "Rain", mitigation: "Tent" },
    ]);
    expect(parseBackup(null, EMPTY_STORE)).toEqual({ ok: false, reason: "bad" });
    expect(parseBackup("[]", EMPTY_STORE)).toEqual({ ok: false, reason: "bad" });
  });
});
