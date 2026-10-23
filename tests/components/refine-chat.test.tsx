// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describeChange } from "@/components/planner/refine-chat";
import { getDictionary } from "@/lib/i18n";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { jsonError, mockFetch } from "../helpers/fetch";
import { expectAccessible } from "../helpers/render";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

function ready(brief: Brief = weddingBrief): PlanRecord {
  return withEnrichment(
    recordFor(brief),
    sampleEnrichment,
    { facts: factsOf(brief), locale: "en" },
    NOW,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("refine chat", () => {
  const reply = {
    reply: "Here is a leaner plan.",
    changes: [
      { op: "set_budget", amount: 15_00_000 },
      { op: "add_idea", title: "Phoolon ki holi", detail: "At the mehndi", area: "activity" },
      { op: "self_destruct" },
    ],
  };

  it("proposes changes and applies only the ones approved", async () => {
    const fetch = mockFetch({ "/api/refine": () => Response.json(reply) });
    const { saved, container } = renderWorkspace(ready());
    await openTab("Ideas");
    const p = panel();
    await userEvent.click(p.getByLabelText("Your message"));
    await userEvent.paste("Bring it down to 15 lakh");
    await userEvent.click(p.getByRole("button", { name: "Send" }));
    expect(await p.findByText("Here is a leaner plan.")).toBeInTheDocument();
    expect(fetch.bodies["/api/refine"]?.[0]).toMatchObject({
      message: "Bring it down to 15 lakh",
      history: [],
    });
    await expectAccessible(container);
    expect(p.getByRole("checkbox", { name: "Set the budget to ₹15,00,000" })).not.toBeChecked();
    expect(p.getByRole("button", { name: "Apply selected" })).toBeDisabled();
    await userEvent.click(p.getByRole("checkbox", { name: "Set the budget to ₹15,00,000" }));
    await userEvent.click(p.getByRole("button", { name: "Apply selected" }));
    expect(saved.current.brief.budget).toBe(15_00_000);
    expect(saved.current.ideas).toEqual([]);
    expect(screen.getByText("Applied 1 change.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved.current.brief.budget).toBe(18_00_000);
  });

  it("sends earlier turns, can discard a proposal and shows errors", async () => {
    let calls = 0;
    const fetch = mockFetch({
      "/api/refine": () => {
        calls += 1;
        if (calls === 1) return Response.json(reply);
        if (calls === 2) return Response.json({ reply: "Only a question.", changes: [] });
        if (calls === 3) return Response.json({ nonsense: true });
        return jsonError("rate_limited", 429);
      },
    });
    renderWorkspace(ready());
    await openTab("Ideas");
    const p = panel();
    const send = async (text: string) => {
      await userEvent.click(p.getByLabelText("Your message"));
      await userEvent.paste(text);
      await userEvent.click(p.getByRole("button", { name: "Send" }));
    };
    await send("Cut costs");
    await userEvent.click(await p.findByRole("button", { name: "Discard" }));
    expect(p.queryByRole("group", { name: "Proposed changes" })).toBeNull();
    await send("What about music?");
    expect(await p.findByText("Only a question.")).toBeInTheDocument();
    expect(fetch.bodies["/api/refine"]?.[1]).toMatchObject({
      history: [
        { role: "user", text: "Cut costs" },
        { role: "assistant", text: "Here is a leaner plan." },
      ],
    });
    await send("Again");
    expect(await p.findByText(/couldn't answer just now/)).toBeInTheDocument();
    expect(p.getByLabelText("Your message")).toHaveValue("Again");
    await userEvent.click(p.getByRole("button", { name: "Send" }));
    expect(await p.findByText(/Too many requests/)).toBeInTheDocument();
  });

  it("describes every kind of change in plain words, shifts in rupees", () => {
    const dict = getDictionary("en");
    const preview = () => ({ before: 1_00_000, after: 1_20_000 });
    expect(describeChange({ op: "set_guests", count: 120 }, dict, "en", preview)).toBe(
      "Set the guest count to 120",
    );
    expect(describeChange({ op: "set_date", date: "2027-03-01" }, dict, "en", preview)).toBe(
      "Move the date to 1 Mar 2027",
    );
    expect(
      describeChange({ op: "shift_category", category: "decor", factor: 1.2 }, dict, "en", preview),
    ).toBe("Give Decor and flowers more: ₹1,00,000 to ₹1,20,000");
    expect(
      describeChange({ op: "shift_category", category: "decor", factor: 0.7 }, dict, "en", preview),
    ).toBe("Give Decor and flowers less: ₹1,00,000 to ₹1,20,000");
    expect(
      describeChange(
        { op: "add_task", title: "Book dhol", area: "entertainment", weeksBefore: 3 },
        dict,
        "en",
        preview,
      ),
    ).toBe("Add a task: Book dhol, 3 weeks before");
  });
});
