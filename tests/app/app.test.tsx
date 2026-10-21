// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

const cookieStore = new Map<string, string>();
const headerStore = new Map<string, string>();
const refresh = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
    }),
  headers: () => Promise.resolve({ get: (name: string) => headerStore.get(name) ?? null }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { default: RootLayout, generateMetadata, viewport } = await import("@/app/layout");
const { default: Home } = await import("@/app/page");
const { default: NotFound } = await import("@/app/not-found");
const { default: ErrorPage } = await import("@/app/error");
const privacy = await import("@/app/privacy/page");
const terms = await import("@/app/terms/page");
const { LanguageSwitch } = await import("@/components/language-switch");
const { linkify } = await import("@/components/legal/legal-page");
const { renderIn, expectAccessible } = await import("../helpers/render");

beforeEach(() => {
  cookieStore.clear();
  headerStore.clear();
  refresh.mockClear();
});

describe("root layout", () => {
  it("renders the page in the saved language with skip link, header and footer", async () => {
    cookieStore.set("lang", "hi");
    const tree = (await RootLayout({ children: <p>content</p> })) as ReactElement<{
      lang: string;
      children: ReactElement<{ children: unknown }>;
    }>;
    expect(tree.props.lang).toBe("hi");
    const { container } = render(tree.props.children.props.children as ReactElement);
    expect(screen.getByRole("link", { name: "मुख्य सामग्री पर जाएँ" })).toHaveAttribute(
      "href",
      "#main",
    );
    expect(screen.getByRole("main")).toHaveTextContent("content");
    expect(screen.getByRole("link", { name: "निजता" })).toHaveAttribute("href", "/privacy");
    await expectAccessible(container);
  });

  it("follows the browser language when nothing is saved, and sets metadata", async () => {
    headerStore.set("accept-language", "hi-IN,hi;q=0.9");
    expect((await generateMetadata()).description).toContain("बजट");
    headerStore.clear();
    const meta = await generateMetadata();
    expect(meta.title).toEqual({
      default: "Shamiyana: plan weddings, birthdays and community events",
      template: "%s · Shamiyana",
    });
    expect(viewport.colorScheme).toBe("light dark");
  });
});

describe("pages", () => {
  it("renders the planner home", () => {
    renderIn(<Home />);
    expect(document.body.textContent).toBeTruthy();
  });

  it("renders a real 404 with a way back", async () => {
    renderIn(await NotFound());
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the planner" })).toHaveAttribute("href", "/");
  });

  it("renders an error page that can retry", async () => {
    const reset = vi.fn();
    renderIn(<ErrorPage reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
  });

  it.each([
    ["privacy", privacy, "Privacy", "What is sent to the AI"],
    ["terms", terms, "Terms", "AI suggestions"],
  ])("renders the %s page in both languages", async (_name, page, title, section) => {
    expect((await page.generateMetadata()).title).toBe(title);
    const { container, unmount } = renderIn(await page.default());
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: section })).toBeInTheDocument();
    await expectAccessible(container);
    unmount();
    cookieStore.set("lang", "hi");
    renderIn(await page.default(), "hi");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/[ऀ-ॿ]/);
  });
});

describe("policy links", () => {
  it("turns bare https links into link runs", () => {
    expect(linkify("See https://ai.google.dev/gemini-api/terms for more")).toEqual([
      { at: 0, text: "See ", link: false },
      { at: 4, text: "https://ai.google.dev/gemini-api/terms", link: true },
      { at: 42, text: " for more", link: false },
    ]);
  });
});

describe("language switch", () => {
  it("saves the other language in a cookie and re-renders on the server", async () => {
    renderIn(<LanguageSwitch />);
    const button = screen.getByRole("button", { name: "पेज हिंदी में देखें" });
    expect(button).toHaveAttribute("lang", "hi");
    await userEvent.click(button);
    expect(document.cookie).toContain("lang=hi");
    expect(refresh).toHaveBeenCalled();
  });

  it("switches back to English and marks the cookie secure on https", async () => {
    const original = window.location;
    Object.defineProperty(window, "location", {
      value: { protocol: "https:", origin: original.origin, hash: "", pathname: "/", search: "" },
      configurable: true,
    });
    const set = vi.spyOn(document, "cookie", "set");
    renderIn(<LanguageSwitch />, "hi");
    await userEvent.click(screen.getByRole("button", { name: "View this page in English" }));
    expect(set).toHaveBeenCalledWith(expect.stringMatching(/^lang=en; .*; Secure$/));
    Object.defineProperty(window, "location", { value: original, configurable: true });
  });
});
