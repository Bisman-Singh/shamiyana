// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { ShareDialog } from "@/components/planner/share-dialog";
import type * as Share from "@/lib/export/share";
import { recordFor, weddingBrief } from "../fixtures";
import { renderIn } from "../helpers/render";

const encoded = vi.hoisted(() => ({
  value: "x".repeat(40_000),
  hold: false,
  release: (value: string): string => value,
}));

vi.mock("@/lib/export/share", async (load) => ({
  ...(await load<typeof Share>()),
  encodeShare: () =>
    encoded.hold
      ? new Promise<string>((resolve) => {
          encoded.release = (value) => {
            resolve(value);
            return value;
          };
        })
      : Promise.resolve(encoded.value),
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
});

describe("share dialog limits", () => {
  it("sends the user to a backup file when the plan is too big for a link", async () => {
    encoded.hold = false;
    renderIn(<ShareDialog record={recordFor(weddingBrief)} onClose={vi.fn()} />);
    expect(await screen.findByText(/too large for a link/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Share link")).toBeNull();
  });

  it("shows loading until the link is ready and survives closing early", async () => {
    encoded.hold = true;
    const { unmount } = renderIn(
      <ShareDialog record={recordFor(weddingBrief)} onClose={vi.fn()} />,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    unmount();
    encoded.release("late");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByLabelText("Share link")).toBeNull();
  });
});
