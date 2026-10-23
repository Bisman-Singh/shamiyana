// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderIn } from "../helpers/render";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("brief form fields", () => {
  it("accepts typed values in every field and every choice", async () => {
    const onSubmit = vi.fn();
    const { BriefForm } = await import("@/components/planner/brief/brief-form");
    renderIn(<BriefForm today="2026-10-21" editing={false} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Event name"), "Mela");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-12-01" } });
    await userEvent.type(screen.getByLabelText("City or town"), "Pune");
    await userEvent.type(screen.getByLabelText("Guests"), "300");
    await userEvent.type(screen.getByLabelText("Total budget in rupees"), "250000");
    await userEvent.click(screen.getByRole("radio", { name: "Modern" }));
    await userEvent.click(screen.getByRole("radio", { name: "Jain" }));
    await userEvent.type(screen.getByLabelText(/Anything else/), "Rangoli");
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Mela",
        guests: 300,
        budget: 2_50_000,
        style: "modern",
        food: "jain",
        notes: "Rangoli",
      }),
    );
  });
});
