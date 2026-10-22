// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describeChange } from "@/components/planner/refine-chat";
import { getDictionary } from "@/lib/i18n";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { stubCanvas, stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch, streamed } from "../helpers/fetch";
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
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await openTab("Ideas");
    expect(
      await panel().findByText("Marigold canopy", { selector: ".idea-title" }),
    ).toBeInTheDocument();
  });

  it("asks for fresh ideas, skipping the cache, on request", async () => {
    const fetch = mockFetch({ "/api/plan": () => streamed([answer]) });
    renderWorkspace(ready());
    await userEvent.click(screen.getByRole("button", { name: "New ideas" }));
    await waitFor(() => {
      expect(fetch.bodies["/api/plan"]?.at(-1)).toMatchObject({ fresh: true });
    });
  });

  it("keeps what arrived when the answer stops early", async () => {
    mockFetch({ "/api/plan": () => streamed([answer.slice(0, 120)]) });
    const { saved } = renderWorkspace(recordFor(weddingBrief));
    expect(
      await screen.findByText("The answer stopped early. Showing what arrived."),
    ).toBeInTheDocument();
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

describe("a new photo while one is being read", () => {
  it("drops the old answer and shows only the new one", async () => {
    stubCanvas();
    stubObjectUrls();
    const seen: AbortSignal[] = [];
    let call = 0;
    mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/vision": (_body, init) => {
        call += 1;
        if (call === 1) {
          return new Promise<Response>((_resolve, reject) => {
            if (init.signal) seen.push(init.signal);
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          });
        }
        return Response.json({
          kind: "decor",
          mood: "Bright",
          palette: [],
          ideas: [{ area: "decor", title: "Second photo idea", detail: "" }],
          notes: [],
        });
      },
    });
    renderWorkspace(ready());
    await openTab("Ideas");
    const input = panel().getByLabelText("Choose a photo");
    await userEvent.upload(input, new File(["a"], "a.jpg", { type: "image/jpeg" }));
    await userEvent.click(
      await panel().findByRole("button", { name: "Get ideas from this photo" }),
    );
    await userEvent.upload(input, new File(["b"], "b.jpg", { type: "image/jpeg" }));
    expect(seen[0]?.aborted).toBe(true);
    await userEvent.click(
      await panel().findByRole("button", { name: "Get ideas from this photo" }),
    );
    expect(
      await panel().findByText("Second photo idea", { selector: ".idea-title" }),
    ).toBeInTheDocument();
    expect(call).toBe(2);
  });
});

describe("photo ideas", () => {
  function mockCanvas(blob: Blob | null = new Blob(["jpeg"], { type: "image/jpeg" })) {
    stubCanvas({ width: 3200, height: 1600, blob });
    stubObjectUrls("blob:preview");
  }

  const photo = () => new File(["raw"], "venue.png", { type: "image/png" });

  it("shrinks the photo, sends it once and shows colours and ideas", async () => {
    mockCanvas();
    const fetch = mockFetch({
      "/api/vision": () =>
        Response.json({
          kind: "venue",
          mood: "Open lawn at dusk",
          palette: [{ name: "Saffron", hex: "#f39b2d" }],
          ideas: [{ area: "decor", title: "Lantern path", detail: "Along the lawn edge." }],
          notes: ["Uneven ground near the stage"],
        }),
    });
    const { saved, container } = renderWorkspace(ready());
    await openTab("Ideas");
    const p = panel();
    await userEvent.upload(p.getByLabelText("Choose a photo"), photo());
    expect(await p.findByRole("img", { name: "The photo you chose" })).toHaveAttribute(
      "src",
      "blob:preview",
    );
    await userEvent.click(p.getByRole("button", { name: "Get ideas from this photo" }));
    expect(await p.findByText("Open lawn at dusk")).toBeInTheDocument();
    const sent = fetch.bodies["/api/vision"]?.[0] as FormData;
    expect((sent.get("image") as File).type).toBe("image/jpeg");
    expect(JSON.parse(sent.get("fields") as string)).toMatchObject({
      locale: "en",
      facts: { city: "Jaipur" },
    });
    await expectAccessible(container);
    const card = p.getByText("Lantern path", { selector: ".idea-title" }).closest("li");
    await userEvent.click(
      within(card ?? document.body).getByRole("button", { name: /^Save idea/ }),
    );
    expect(saved.current.ideas[0]).toMatchObject({ title: "Lantern path" });
  });

  it("refuses other file types and reports a photo it can't read", async () => {
    mockCanvas(null);
    renderWorkspace(ready());
    await openTab("Ideas");
    const p = panel();
    await userEvent.upload(
      p.getByLabelText("Choose a photo"),
      new File(["gif"], "x.gif", { type: "image/gif" }),
      {
        applyAccept: false,
      },
    );
    expect(await p.findByText("Use a JPEG, PNG or WebP photo.")).toBeInTheDocument();
    await userEvent.upload(p.getByLabelText("Choose a photo"), photo());
    expect(await p.findByText("Couldn't read that photo. Try another one.")).toBeInTheDocument();
  });

  it("explains a failed upload and keeps the photo for another try", async () => {
    mockCanvas();
    mockFetch({ "/api/vision": () => jsonError("ai_unavailable", 503) });
    renderWorkspace(ready());
    await openTab("Ideas");
    const p = panel();
    await userEvent.upload(p.getByLabelText("Choose a photo"), photo());
    await userEvent.click(await p.findByRole("button", { name: "Get ideas from this photo" }));
    expect(await p.findByText(/AI ideas are switched off/)).toBeInTheDocument();
    expect(p.getByRole("button", { name: "Get ideas from this photo" })).toBeEnabled();
  });
});

describe("share dialog", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  });

  it("builds a link, copies it and offers the share sheet", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const share = vi.fn(() => Promise.reject(new Error("cancelled")));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    renderWorkspace(ready());
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    const dialog = await screen.findByRole("dialog", { name: "Share this plan" });
    const link = await within(dialog).findByLabelText("Share link");
    expect((link as HTMLInputElement).value).toMatch(
      /^http:\/\/localhost(:\d+)?\/#plan=[A-Za-z0-9_-]+$/,
    );
    await userEvent.click(link);
    await userEvent.click(within(dialog).getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith((link as HTMLInputElement).value);
    expect(within(dialog).getByText("Link copied.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Share with an app" }));
    expect(share).toHaveBeenCalled();
    dialog.dispatchEvent(new Event("close"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("tells the user to copy by hand when the clipboard refuses", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    });
    Reflect.deleteProperty(navigator, "share");
    renderWorkspace(ready());
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(await within(dialog).findByRole("button", { name: "Copy link" }));
    expect(within(dialog).getByText(/Couldn't copy automatically/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Share with an app" })).toBeNull();
  });
});
