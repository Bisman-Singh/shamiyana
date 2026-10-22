"use client";

import { useLocale } from "../locale-provider";
import { useFocusOnMount } from "./announcer";

/** The Undo action of a notice. It takes focus as it appears, so a keyboard user can undo at once. */
export function UndoButton({ onUndo }: { onUndo: () => void }) {
  const { dict } = useLocale();
  const ref = useFocusOnMount<HTMLButtonElement>(true);
  return (
    <button ref={ref} type="button" className="btn btn-small" onClick={onUndo}>
      {dict.common.undo}
    </button>
  );
}
