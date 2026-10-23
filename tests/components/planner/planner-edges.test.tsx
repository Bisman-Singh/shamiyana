// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanStore } from "@/lib/client/plan-store";
import { Planner } from "@/components/planner/planner";
import { stubObjectUrls } from "@/tests/helpers/browser";
import { mockFetch } from "@/tests/helpers/fetch";
import { recordFor, sampleEnrichment, weddingBrief } from "@/tests/helpers/fixtures";
import { renderIn } from "@/tests/helpers/render";
import { MemoryStorage } from "@/tests/helpers/storage";

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

  it("offers to download or delete saved data that couldn't be read", async () => {
    stubObjectUrls("blob:unreadable");
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    const storage = new MemoryStorage();
    storage.setItem("shamiyana:v1", "{not json");
    renderIn(<Planner store={new PlanStore(() => storage)} />);
    expect(await screen.findByText(/couldn't be read/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Download it" }));
    expect(saved).toEqual(["shamiyana-unreadable.json"]);
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    expect(storage.getItem("shamiyana:unreadable")).toBeNull();
    expect(screen.queryByText(/couldn't be read/)).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId("announcer")).toHaveTextContent(
        "The data that couldn't be read was deleted.",
      );
    });
  });

  it("offers only Close when the unreadable data couldn't be kept", async () => {
    const storage = new MemoryStorage();
    storage.setItem("shamiyana:v1", "{not json");
    storage.failWrites = true;
    renderIn(<Planner store={new PlanStore(() => storage)} />);
    expect(await screen.findByText(/couldn't be read/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete it" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
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
