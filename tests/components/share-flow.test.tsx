// @vitest-environment jsdom
import { factsOf } from "@/lib/plan/schema";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withEnrichment } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { renderWorkspace } from "../helpers/workspace";

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
