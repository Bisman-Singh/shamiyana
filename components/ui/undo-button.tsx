"use client";

import { useEffectEvent, useLayoutEffect } from "react";
import { useLocale } from "../locale-provider";
import { useFocusOnMount } from "./focus";

interface UndoButtonProps {
  onUndo: () => void;
  /** Called when the button goes away while it has focus, so focus can land somewhere useful. */
  onVanish?: () => void;
}

/** The Undo action of a notice. It takes focus as it appears, so a keyboard user can undo at once. */
export function UndoButton({ onUndo, onVanish }: Readonly<UndoButtonProps>) {
  const { dict } = useLocale();
  const ref = useFocusOnMount<HTMLButtonElement>(true);
  const vanish = useEffectEvent(() => onVanish?.());
  // A layout cleanup runs before React removes the button, while it can still hold focus.
  useLayoutEffect(() => {
    const button = ref.current;
    return () => {
      if (button !== null && button === document.activeElement) vanish();
    };
  }, [ref]);
  return (
    <button ref={ref} type="button" className="btn btn-small" onClick={onUndo}>
      {dict.common.undo}
    </button>
  );
}
