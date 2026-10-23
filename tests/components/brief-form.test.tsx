// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BriefForm } from "@/components/planner/brief-form";
import { draftFromBrief } from "@/lib/plan/draft";
import { TODAY, birthdayBrief, weddingBrief } from "../helpers/fixtures";
import { expectAccessible, renderIn } from "../helpers/render";

describe("BriefForm", () => {
  it("is accessible and lists every problem when submitted empty", async () => {
    const onSubmit = vi.fn();
    const { container } = renderIn(<BriefForm today={TODAY} editing={false} onSubmit={onSubmit} />);
    await expectAccessible(container);
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Please fix 5 fields.");
    expect(screen.getByLabelText("Event name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Budget", { exact: false })).toHaveAccessibleDescription(
      /₹5,000 to ₹50 crore/,
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await expectAccessible(container);
  });

  it("fills an example and submits a valid brief", async () => {
    const onSubmit = vi.fn();
    renderIn(<BriefForm today={TODAY} editing={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /Wedding in Jaipur/ }));
    expect(screen.getByLabelText("Event name")).toHaveValue("Winter wedding in Jaipur");
    expect(screen.getByText("That is 18 lakh.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "wedding", city: "Jaipur", guests: 250, budget: 18_00_000 }),
    );
  });

  it("asks the right extra question for each event type", async () => {
    renderIn(<BriefForm today={TODAY} editing={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Which functions?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Birthday/ }));
    await userEvent.click(screen.getByRole("radio", { name: "A child" }));
    expect(screen.getByRole("radio", { name: "A child" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Community event/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Sports day" }));
    expect(screen.getByRole("radio", { name: "Sports day" })).toBeChecked();
    expect(screen.queryByRole("group", { name: "Which functions?" })).toBeNull();
  });

  it("needs at least one wedding function and keeps typed input on error", async () => {
    const onSubmit = vi.fn();
    renderIn(<BriefForm today={TODAY} editing={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /Wedding in Jaipur/ }));
    for (const name of ["Haldi", "Mehndi", "Sangeet", "Wedding ceremony"]) {
      await userEvent.click(screen.getByRole("checkbox", { name }));
    }
    await userEvent.click(screen.getByRole("checkbox", { name: "Reception" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Reception" }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pick at least one function.");
    expect(screen.getByLabelText("City or town")).toHaveValue("Jaipur");
    await userEvent.click(screen.getByRole("checkbox", { name: "Roka" }));
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ functions: ["roka"] }));
  });

  it("rejects a past date and counts note characters", async () => {
    renderIn(<BriefForm today={TODAY} editing={false} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /80th birthday/ }));
    const date = screen.getByLabelText("Date");
    await userEvent.clear(date);
    await userEvent.type(date, "2026-10-01");
    const notes = screen.getByLabelText(/Anything else/);
    expect(notes).toHaveValue("Ground floor only, Dadi uses a walker.");
    await userEvent.clear(notes);
    await userEvent.click(notes);
    await userEvent.paste("Garden");
    expect(screen.getByText(/6 of 500/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Make my plan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pick an event date from today on.");
  });

  it("edits an existing brief, in Hindi, and can be cancelled", async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { container } = renderIn(
      <BriefForm
        today={TODAY}
        editing
        initial={draftFromBrief(birthdayBrief)}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
      "hi",
    );
    expect(screen.getByRole("heading", { name: "आयोजन का विवरण बदलें" })).toBeInTheDocument();
    expect(screen.queryByText("या किसी उदाहरण से शुरू करें")).toBeNull();
    await expectAccessible(container);
    await userEvent.click(screen.getByRole("button", { name: "बदलाव सहेजें" }));
    expect(onSubmit).toHaveBeenCalledWith(birthdayBrief);
    await userEvent.click(screen.getByRole("button", { name: "रद्द करें" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("keeps every type's extra answers when switching back", () => {
    const draft = draftFromBrief(weddingBrief);
    expect(draft.functions).toEqual(weddingBrief.functions);
    expect(draft.honoree).toBe("adult");
  });
});
