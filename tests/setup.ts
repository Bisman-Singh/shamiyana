import { configure } from "@testing-library/dom";
import "@testing-library/jest-dom/vitest";

// The shared live region repeats visible messages for screen readers; text
// queries skip it, and announcement tests read it by its test id.
configure({ defaultIgnore: 'script, style, [data-testid="announcer"]' });

// jsdom has no canvas; tests that draw stub it themselves, everything else gets "no context".
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = () => null;
}
