// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { ShareDialog } from "@/components/planner/share-dialog";
import { MAX_ENCODED } from "@/lib/export/share";
import type * as Share from "@/lib/export/share";
import { recordFor, weddingBrief } from "../fixtures";
import { renderIn } from "../helpers/render";

const encoded = vi.hoisted(() => ({
  value: "x".repeat(40_000),
  hold: false,
  release: (value: string): string => value,
  fail: false,
  reject: (): void => undefined,
}));

vi.mock("@/lib/export/share", async (load) => ({
  ...(await load<typeof Share>()),
  encodeShare: () => {
    if (encoded.fail) {
      return new Promise<string>((_resolve, reject) => {
        encoded.reject = () => {
          reject(new Error("no compression"));
        };
      });
    }
    if (encoded.hold) {
      return new Promise<string>((resolve) => {
        encoded.release = (value) => {
          resolve(value);
          return value;
        };
      });
    }
    return Promise.resolve(encoded.value);
  },
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
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("offers a link right up to the longest fragment the decoder accepts", async () => {
    encoded.value = "x".repeat(MAX_ENCODED);
    renderIn(<ShareDialog record={recordFor(weddingBrief)} onClose={vi.fn()} />);
    expect(await screen.findByLabelText("Share link")).toHaveValue(
      `${window.location.origin}/#plan=${"x".repeat(MAX_ENCODED)}`,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/anyone with it can open/);
    expect(screen.getByRole("button", { name: "Copy link" })).toHaveFocus();
    encoded.value = "x".repeat(40_000);
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

describe("share dialog failure", () => {
  it("says the link couldn't be built and points to a backup", async () => {
    encoded.fail = true;
    renderIn(<ShareDialog record={recordFor(weddingBrief)} onClose={vi.fn()} />);
    encoded.reject();
    expect(await screen.findByText(/Couldn't build a link/)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("ignores a failure that arrives after the dialog closed", async () => {
    encoded.fail = true;
    const { unmount } = renderIn(
      <ShareDialog record={recordFor(weddingBrief)} onClose={vi.fn()} />,
    );
    unmount();
    encoded.reject();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/Couldn't build a link/)).toBeNull();
    encoded.fail = false;
  });
});
