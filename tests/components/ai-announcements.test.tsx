// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { recordFor, sampleEnrichment, weddingBrief, readyPlan } from "../helpers/fixtures";
import { stubCanvas, stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch, streamed } from "../helpers/fetch";
import { openTab, panel, renderWorkspace } from "../helpers/workspace";

/** The announcer's text once its frame-delayed update has landed. */
async function announced(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByTestId("announcer")).toHaveTextContent(text);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AI announcements", () => {
  it("keeps AI tasks and proposed tasks from landing before today", async () => {
    const late = { title: "Print a guest map", area: "planning" as const, weeksBefore: 40 };
    mockFetch({
      "/api/plan": () => streamed([JSON.stringify({ ...sampleEnrichment, tasks: [late] })]),
      "/api/refine": () =>
        Response.json({
          reply: "Added.",
          changes: [{ op: "add_task", title: "Hire a valet", area: "transport", weeksBefore: 40 }],
        }),
    });
    const { saved } = renderWorkspace(recordFor(weddingBrief));
    await announced("Ideas ready.");
    expect(saved.current.tasks.find((t) => t.title === late.title)?.leadDays).toBe(16 * 7);
    await openTab("Ideas");
    await userEvent.click(panel().getByLabelText("Your message"));
    await userEvent.paste("Add a valet task");
    await userEvent.click(panel().getByRole("button", { name: "Send" }));
    expect(
      await panel().findByText("Add a task: Hire a valet, 16 weeks before"),
    ).toBeInTheDocument();
  });

  it("says when ideas are ready", async () => {
    mockFetch({ "/api/plan": () => streamed([JSON.stringify(sampleEnrichment)]) });
    renderWorkspace(recordFor(weddingBrief));
    await announced("Ideas ready.");
  });

  it("says when the assistant proposes nothing, and returns focus to the message box after Discard", async () => {
    let call = 0;
    mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/refine": () => {
        call += 1;
        return call === 1
          ? Response.json({ reply: "Music is already covered.", changes: [] })
          : Response.json({ reply: "Done.", changes: [{ op: "set_guests", count: 300 }] });
      },
    });
    renderWorkspace(readyPlan());
    await openTab("Ideas");
    const box = panel().getByLabelText("Your message");
    await userEvent.click(box);
    await userEvent.paste("What about music?");
    await userEvent.click(panel().getByRole("button", { name: "Send" }));
    await announced("Music is already covered. No changes proposed.");
    expect(panel().getByText("No changes proposed.")).toBeInTheDocument();
    await userEvent.click(box);
    await userEvent.paste("Make it 300 guests");
    await userEvent.click(panel().getByRole("button", { name: "Send" }));
    await userEvent.click(await panel().findByRole("button", { name: "Discard" }));
    expect(box).toHaveFocus();
  });

  it("does not send a second message while the first is pending", async () => {
    const { promise: answer, resolve: release } = Promise.withResolvers<Response>();
    const fetch = mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/refine": () => answer,
    });
    renderWorkspace(readyPlan());
    await openTab("Ideas");
    await userEvent.click(panel().getByLabelText("Your message"));
    await userEvent.paste("Hello");
    const send = panel().getByRole("button", { name: "Send" });
    await userEvent.click(send);
    await userEvent.click(panel().getByRole("button", { name: "Thinking…" }));
    release(Response.json({ reply: "Hi.", changes: [] }));
    await announced(/Hi\./);
    expect(fetch.bodies["/api/refine"]).toHaveLength(1);
  });
});

describe("photo guards", () => {
  it("sends one photo at a time and saves each idea once", async () => {
    stubCanvas();
    stubObjectUrls("blob:p");
    const { promise: answer, resolve: release } = Promise.withResolvers<Response>();
    const fetch = mockFetch({
      "/api/plan": () => jsonError("ai_unavailable", 503),
      "/api/vision": () => answer,
    });
    const { saved } = renderWorkspace(readyPlan());
    await openTab("Ideas");
    await userEvent.upload(
      panel().getByLabelText("Choose a photo"),
      new File(["x"], "a.jpg", { type: "image/jpeg" }),
    );
    const go = await panel().findByRole("button", { name: "Get ideas from this photo" });
    await userEvent.click(go);
    await userEvent.click(panel().getByRole("button", { name: "Looking at your photo…" }));
    release(
      Response.json({
        kind: "decor",
        mood: "Warm",
        palette: [],
        ideas: [{ area: "decor", title: "Torans", detail: "" }],
        notes: [],
      }),
    );
    await announced("Ideas from your photo are ready.");
    expect(fetch.bodies["/api/vision"]).toHaveLength(1);
    const save = panel().getByRole("button", { name: /^Save idea Torans/ });
    await userEvent.click(save);
    await userEvent.click(save);
    expect(saved.current.ideas.filter((i) => i.title === "Torans")).toHaveLength(1);
  });
});
