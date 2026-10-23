// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Planner } from "@/components/planner/planner";
import { PlanStore } from "@/lib/client/plan-store";
import { recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { mockFetch } from "../helpers/fetch";
import { renderIn } from "../helpers/render";
import { MemoryStorage } from "../helpers/storage";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("planner edges", () => {
  it("offers a shared plan even when full, but can't add it, and lists plans with none open", async () => {
    const { encodeShare } = await import("@/lib/export/share");
    window.history.replaceState(null, "", `/#plan=${await encodeShare(recordFor(weddingBrief))}`);
    const plans = Array.from({ length: 20 }, (_, i) => recordFor(weddingBrief, { id: `p${i}` }));
    const storage = new MemoryStorage();
    storage.setItem("shamiyana:v1", JSON.stringify({ version: 1, activeId: null, plans }));
    renderIn(<Planner store={new PlanStore(() => storage)} />);
    expect(await screen.findByRole("button", { name: "Add to my plans" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New plan" })).toHaveAccessibleDescription(
      /up to 20 plans/,
    );
    window.history.replaceState(null, "", "/");
  });

  it("ignores a restore with no file chosen", () => {
    const store = new PlanStore(() => new MemoryStorage());
    renderIn(<Planner store={store} />);
    fireEvent.change(screen.getByLabelText("Restore from a backup"), { target: { files: [] } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("drops ideas that arrive for a plan deleted while they were being written", async () => {
    let release: () => void = () => undefined;
    const answer = JSON.stringify(sampleEnrichment);
    mockFetch({
      "/api/plan": () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(answer.slice(0, 40)));
              release = () => {
                controller.enqueue(new TextEncoder().encode(answer.slice(40)));
                controller.close();
              };
            },
          }),
        ),
    });
    const store = new PlanStore(() => new MemoryStorage());
    renderIn(<Planner store={store} />);
    await userEvent.click(screen.getByRole("button", { name: /Wedding in Jaipur/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    await screen.findByText(/Gemini is writing ideas/);
    await userEvent.click(screen.getByRole("button", { name: "Delete this plan" }));
    release();
    await waitFor(() => {
      expect(store.getSnapshot().data.plans).toEqual([]);
    });
  });
});
