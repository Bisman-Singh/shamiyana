import "@testing-library/jest-dom/vitest";

// jsdom has no canvas; tests that draw stub it themselves, everything else gets "no context".
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = () => null;
}
