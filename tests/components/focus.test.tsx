// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorPage from "@/app/error";
import { LocaleProvider } from "@/components/locale-provider";
import { Planner } from "@/components/planner/planner";
import { AnnouncerProvider } from "@/components/ui/announcer";
import { PlanStore } from "@/lib/client/plan-store";
import { getDictionary } from "@/lib/i18n";
import { jsonError, mockFetch } from "../helpers/fetch";
import { MemoryStorage } from "../helpers/storage";

/** The announcer's text once its frame-delayed update has landed. */
async function announced(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByTestId("announcer")).toHaveTextContent(text);
  });
}

function planner() {
  const store = new PlanStore(() => new MemoryStorage());
  render(
    <LocaleProvider locale="en" dict={getDictionary("en")}>
      <AnnouncerProvider>
        <Planner store={store} />
      </AnnouncerProvider>
    </LocaleProvider>,
  );
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("focus follows every view change", () => {
  it("lands on the plan title after creating, editing and cancelling, and on the form title when it opens", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    planner();
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: /Diwali mela/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(screen.getByRole("heading", { level: 1, name: "Block C Diwali mela" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(screen.getByRole("heading", { level: 1, name: "Edit event details" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { level: 1, name: "Block C Diwali mela" })).toHaveFocus();
  });

  it("puts a deleted plan back with Undo and focuses it", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    const store = planner();
    await userEvent.click(screen.getByRole("button", { name: /Diwali mela/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    const id = store.getSnapshot().data.plans[0]?.id;
    await userEvent.click(screen.getByRole("button", { name: "Delete this plan" }));
    await announced("Deleted “Block C Diwali mela”.");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(store.getSnapshot().data.plans.map((p) => p.id)).toEqual([id]);
    expect(screen.getByRole("heading", { level: 1, name: "Block C Diwali mela" })).toHaveFocus();
  });
});

describe("deleting twice", () => {
  it("gives Undo focus again for the second plan", async () => {
    mockFetch({ "/api/plan": () => jsonError("ai_unavailable", 503) });
    planner();
    await userEvent.click(screen.getByRole("button", { name: /Diwali mela/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    await userEvent.click(screen.getByRole("button", { name: "New plan" }));
    await userEvent.click(screen.getByRole("button", { name: /80th birthday/ }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete this plan" }));
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Delete this plan" }));
    await announced(/Deleted “Block C Diwali mela”/);
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
  });
});

describe("error page", () => {
  it("moves focus to what happened", () => {
    render(
      <LocaleProvider locale="en" dict={getDictionary("en")}>
        <ErrorPage reset={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toHaveFocus();
  });
});
