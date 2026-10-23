// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanStore, STORE_KEY } from "@/lib/client/plan-store";
import { encodeShare } from "@/lib/export/share";
import { LIMITS } from "@/lib/plan/constants";
import { Planner } from "@/components/planner/planner";
import { jsonError, mockFetch, streamed } from "@/tests/helpers/fetch";
import { sampleEnrichment, recordFor, weddingBrief } from "@/tests/helpers/fixtures";
import { expectAccessible, renderIn } from "@/tests/helpers/render";
import { MemoryStorage } from "@/tests/helpers/storage";

const enrichment = JSON.stringify(sampleEnrichment);

function setup(storage: Storage | null = new MemoryStorage()) {
  const store = new PlanStore(() => storage);
  const view = renderIn(<Planner store={store} />);
  return { store, storage, ...view };
}

/** The tab panel on screen; hidden panels stay mounted so their state survives a switch. */
const panel = () => within(screen.getByRole("tabpanel"));

async function makeSamplePlan(label = /Wedding in Jaipur/) {
  await userEvent.click(screen.getByRole("button", { name: label }));
  await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Planner", () => {
  it("creates a plan, streams AI ideas into it and saves both", async () => {
    const fetch = mockFetch({
      "/api/plan": () => streamed([enrichment.slice(0, 50), enrichment.slice(50)]),
    });
    const { store, container } = setup();
    await makeSamplePlan();
    expect(
      await screen.findByRole("heading", { name: "Winter wedding in Jaipur", level: 1 }),
    ).toBeInTheDocument();
    expect(await panel().findByText("Marigold courtyard")).toBeInTheDocument();
    expect(fetch.bodies["/api/plan"]?.[0]).toMatchObject({
      locale: "en",
      fresh: false,
      facts: { city: "Jaipur" },
    });
    expect(JSON.stringify(fetch.bodies["/api/plan"])).not.toContain("Winter wedding in Jaipur");
    const saved = store.getSnapshot().data.plans[0];
    expect(saved?.enrichment?.theme.name).toBe("Marigold courtyard");
    expect(saved?.tasks.map((t) => t.source)).toEqual(["ai"]);
    await expectAccessible(container);
  });

  it("says plainly when AI is off and keeps the plan usable", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    setup();
    await makeSamplePlan(/Diwali mela/);
    expect(await screen.findByText(/AI ideas are switched off on this server/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Budget" }));
    expect(screen.getByRole("table", { name: "How the budget splits" })).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_failed", 502) });
    setup();
    await makeSamplePlan();
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Ideas" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowLeft}{Home}{Enter}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(/couldn't answer just now/)).toBeInTheDocument();
  });

  it("edits the brief and asks for fresh ideas for the new details", async () => {
    const fetch = mockFetch({ "/api/plan": () => streamed([enrichment]) });
    setup();
    await makeSamplePlan();
    await panel().findByText("Marigold courtyard");
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    const city = screen.getByLabelText("City or town");
    await userEvent.clear(city);
    await userEvent.click(city);
    await userEvent.paste("Udaipur");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Udaipur")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch.bodies["/api/plan"]).toHaveLength(2);
    });
    expect(fetch.bodies["/api/plan"]?.[1]).toMatchObject({ facts: { city: "Udaipur" } });
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Winter wedding in Jaipur");
  });

  it("deletes a plan with undo and switches between plans", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    const { store } = setup();
    await makeSamplePlan();
    await userEvent.click(screen.getByRole("button", { name: "New plan" }));
    await makeSamplePlan(/80th birthday/);
    const picker = await screen.findByLabelText("Saved plans");
    expect(screen.getByRole("group", { name: "Your plans" })).toContainElement(picker);
    expect(screen.queryByRole("navigation", { name: "Your plans" })).toBeNull();
    await userEvent.selectOptions(picker, "Winter wedding in Jaipur");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dadi turns 80");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Winter wedding in Jaipur");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Delete this plan" }));
    expect(screen.getByText("Deleted “Winter wedding in Jaipur”.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    expect(store.getSnapshot().data.plans).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(store.getSnapshot().data.plans).toHaveLength(2);
  });

  it("restores a backup, refuses a bad file and respects the plan limit", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    const storage = new MemoryStorage();
    const { store } = setup(storage);
    const input = screen.getByLabelText("Restore from a backup");
    const backup = recordFor(weddingBrief, { id: "restored-plan", enrichment: sampleEnrichment });
    await userEvent.upload(
      input,
      new File([JSON.stringify(backup)], "plan.json", { type: "application/json" }),
    );
    expect(await screen.findByText("Plan restored from the backup.")).toBeInTheDocument();
    expect(store.getSnapshot().data.activeId).toBe("restored-plan");

    await userEvent.upload(
      input,
      new File(["{not json"], "plan.json", { type: "application/json" }),
    );
    expect(await screen.findByText("That file isn't a Shamiyana backup.")).toBeInTheDocument();
    await userEvent.upload(
      input,
      new File([JSON.stringify({ hello: 1 })], "x.json", { type: "application/json" }),
    );
    expect(await screen.findByText("That file isn't a Shamiyana backup.")).toBeInTheDocument();

    const plans = Array.from({ length: LIMITS.plansMax }, (_, i) =>
      recordFor(weddingBrief, { id: `p${i}` }),
    );
    act(() => {
      store.commit({ version: 1, activeId: "p0", plans });
    });
    await userEvent.upload(
      input,
      new File([JSON.stringify(backup)], "plan.json", { type: "application/json" }),
    );
    expect(
      await screen.findAllByText(
        `You can keep up to ${LIMITS.plansMax} plans. Delete one to start another.`,
      ),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "New plan" })).toBeDisabled();
  });

  it("offers a shared plan from the link and adds a copy without guests", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    const shared = recordFor(weddingBrief, {
      enrichment: sampleEnrichment,
      done: ["w_book_venue"],
    });
    window.history.replaceState(null, "", `/#plan=${await encodeShare(shared)}`);
    const { store, container } = setup();
    expect(await screen.findByRole("heading", { name: "Open a shared plan?" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("announcer")).toHaveTextContent("Open a shared plan?");
    });
    expect(window.location.hash).toBe("");
    await expectAccessible(container);
    await userEvent.click(screen.getByRole("button", { name: "Add to my plans" }));
    const added = store.getSnapshot().data.plans[0];
    expect(added?.done).toEqual(["w_book_venue"]);
    expect(added?.id).not.toBe(shared.id);
  });

  it("can decline a shared plan, and reports a broken link", async () => {
    window.history.replaceState(null, "", `/#plan=${await encodeShare(recordFor(weddingBrief))}`);
    const first = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("heading", { name: "Open a shared plan?" })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });
    first.unmount();
    window.history.replaceState(null, "", "/#plan=broken");
    setup();
    expect(
      await screen.findByText("This share link is damaged or incomplete."),
    ).toBeInTheDocument();
  });

  it("warns when the browser blocks storage, and the warning can be closed", async () => {
    setup(null);
    expect(screen.getByText(/blocking storage/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(/blocking storage/)).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });
  });

  it("says when storage is full instead of losing the change silently", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    const storage = new MemoryStorage();
    setup(storage);
    storage.failWrites = true;
    await makeSamplePlan();
    expect(await screen.findByText(/Browser storage is full/)).toBeInTheDocument();
    expect(storage.getItem(STORE_KEY)).toBeNull();
  });
});
