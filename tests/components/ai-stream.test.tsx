// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { stubCanvas, stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch, streamed } from "../helpers/fetch";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

function ready(brief: Brief = weddingBrief): PlanRecord {
  return withEnrichment(
    recordFor(brief),
    sampleEnrichment,
    { facts: factsOf(brief), locale: "en" },
    NOW,
  );
}

const answer = JSON.stringify(sampleEnrichment);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AI ideas stream", () => {
  it("shows progress and can be stopped, then tried again", async () => {
    let first = true;
    let release: () => void = () => undefined;
    mockFetch({
      "/api/plan": () => {
        if (!first) return streamed([answer]);
        first = false;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(answer.slice(0, 60)));
              release = () => {
                controller.close();
              };
            },
          }),
        );
      },
    });
    renderWorkspace(recordFor(weddingBrief));
    expect(await screen.findByText("Gemini is writing ideas for Jaipur…")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    release();
    await waitFor(() => {
      expect(screen.queryByText("Gemini is writing ideas for Jaipur…")).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    });
    // a click on empty page space blurs the button with no new target
    screen.getByRole("button", { name: "Try again" }).blur();
    expect(document.body).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New ideas" })).toHaveFocus();
    });
    await openTab("Ideas");
    expect(
      await panel().findByText("Marigold canopy", { selector: ".idea-title" }),
    ).toBeInTheDocument();
  });

  it("keeps focus on the status when a retry ends with no button, and leaves it alone once the user moves on", async () => {
    let calls = 0;
    mockFetch({
      "/api/plan": () => {
        calls += 1;
        return calls === 1 ? jsonError("rate_limited", 429) : jsonError("daily_cap", 503);
      },
    });
    renderWorkspace(recordFor(weddingBrief));
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    const limit = await screen.findByText(/Today's AI limit has been used up/);
    await waitFor(() => {
      expect(document.activeElement?.contains(limit)).toBe(true);
    });
    const edit = screen.getByRole("button", { name: "Edit details" });
    edit.focus();
    expect(edit).toHaveFocus();
  });

  it("asks for fresh ideas, skipping the cache, on request", async () => {
    const fetch = mockFetch({ "/api/plan": () => streamed([answer]) });
    renderWorkspace(ready());
    await userEvent.click(screen.getByRole("button", { name: "New ideas" }));
    await waitFor(() => {
      expect(fetch.bodies["/api/plan"]?.at(-1)).toMatchObject({ fresh: true });
    });
  });

  it("offers no Save on ideas that are still being written", async () => {
    let release: () => void = () => undefined;
    mockFetch({
      "/api/plan": () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(answer.slice(0, -1)));
              release = () => {
                controller.enqueue(new TextEncoder().encode(answer.slice(-1)));
                controller.close();
              };
            },
          }),
        ),
    });
    renderWorkspace(recordFor(weddingBrief));
    await openTab("Ideas");
    expect(
      await panel().findByText("Marigold canopy", { selector: ".idea-title" }),
    ).toBeInTheDocument();
    expect(panel().queryAllByRole("button", { name: /^Save idea/ })).toHaveLength(0);
    release();
    expect(await panel().findAllByRole("button", { name: /^Save idea/ })).not.toHaveLength(0);
  });

  it("keeps what arrived when the answer stops early", async () => {
    mockFetch({ "/api/plan": () => streamed([answer.slice(0, 120)]) });
    const { saved } = renderWorkspace(recordFor(weddingBrief));
    expect(
      await screen.findByText("The answer stopped early. Showing what arrived."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("announcer")).toHaveTextContent("The answer stopped early.");
    });
    expect(saved.current.enrichment?.theme.name).toBe("Marigold courtyard");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  });

  it.each([
    ["rate_limited", 429, "Too many requests at once."],
    ["daily_cap", 503, "Today's AI limit has been used up."],
  ])("explains %s", async (code, status, text) => {
    mockFetch({ "/api/plan": () => jsonError(code, status) });
    renderWorkspace(recordFor(weddingBrief));
    expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
  });

  it("reports a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    renderWorkspace(recordFor(weddingBrief));
    expect(await screen.findByText(/Couldn't reach the server/)).toBeInTheDocument();
  });

  it("does not ask again for a plan whose ideas match its brief", () => {
    const fetch = mockFetch({ "/api/plan": () => streamed([answer]) });
    renderWorkspace(ready());
    expect(screen.getByRole("button", { name: "New ideas" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("leaving the plan", () => {
  /** A request that never answers, and rejects once aborted, the way fetch does. */
  const hanging = (seen: AbortSignal[]) => (_body: unknown, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init.signal;
      if (!signal) return;
      seen.push(signal);
      signal.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });

  it("cancels a pending chat reply and photo answer", async () => {
    stubCanvas();
    stubObjectUrls();
    const seen: AbortSignal[] = [];
    mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/refine": hanging(seen),
      "/api/vision": hanging(seen),
    });
    const { unmount } = renderWorkspace(ready());
    await openTab("Ideas");
    await userEvent.click(panel().getByLabelText("Your message"));
    await userEvent.paste("Less on decor");
    await userEvent.click(panel().getByRole("button", { name: "Send" }));
    await userEvent.upload(
      panel().getByLabelText("Choose a photo"),
      new File(["x"], "a.jpg", { type: "image/jpeg" }),
    );
    await userEvent.click(
      await panel().findByRole("button", { name: "Get ideas from this photo" }),
    );
    expect(seen).toHaveLength(2);
    expect(seen.some((s) => s.aborted)).toBe(false);
    unmount();
    expect(seen.every((s) => s.aborted)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
