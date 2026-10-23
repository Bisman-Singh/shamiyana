// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { stubCanvas, stubObjectUrls } from "../helpers/browser";
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
    expect(input).toHaveAccessibleDescription(/shrunk on your device/);
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
    expect(p.getByRole("img", { name: "Venue: Open lawn at dusk" })).toBeInTheDocument();
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
