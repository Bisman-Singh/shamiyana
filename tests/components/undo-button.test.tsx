// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { focusOpenPanel } from "@/components/ui/focus";
import { UndoButton } from "@/components/ui/undo-button";
import { LocaleProvider } from "@/components/locale-provider";
import { getDictionary } from "@/lib/i18n";

const frames = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve();
          }),
        );
      }),
  );

/** An open panel and an Undo offer that goes away when the plan changes, as AI ideas arriving do. */
function Offer() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <section role="tabpanel" tabIndex={0} aria-label="Panel" />
      {shown ? <UndoButton onUndo={vi.fn()} onVanish={focusOpenPanel} /> : null}
      {/* a script click moves no focus, like an answer arriving while Undo has it */}
      <button
        type="button"
        onClick={() => {
          setShown(false);
        }}
      >
        Answer arrives
      </button>
    </>
  );
}

describe("UndoButton", () => {
  it("keeps focus through strict mode's extra cleanup, then hands it to the panel when really removed", async () => {
    // strict mode outermost, as next dev runs the whole app
    render(
      <StrictMode>
        <LocaleProvider locale="en" dict={getDictionary("en")}>
          <Offer />
        </LocaleProvider>
      </StrictMode>,
    );
    await frames();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    act(() => {
      screen.getByRole("button", { name: "Answer arrives" }).click();
    });
    await frames();
    expect(screen.getByRole("tabpanel", { name: "Panel" })).toHaveFocus();
  });
});
