// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { CheckGroup } from "@/components/ui/check-group";
import { RadioGroup } from "@/components/ui/radio-group";
import { SelectField } from "@/components/ui/select-field";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { expectAccessible } from "@/tests/helpers/render";

describe("form controls", () => {
  it("hands over the chosen option and ignores a value outside the options", () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        id="size"
        label="Size"
        value="m"
        onValueChange={onValueChange}
        options={[
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
        ]}
      />,
    );
    const select = screen.getByLabelText("Size");
    fireEvent.change(select, { target: { value: "s" } });
    expect(onValueChange).toHaveBeenCalledWith("s");
    fireEvent.change(select, { target: { value: "xl" } });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("ties hints and errors to their controls", async () => {
    const { container } = render(
      <form>
        <TextField id="a" label="Name" hint="Your name" error="Required" />
        <TextArea id="b" label="Notes" />
        <TextArea id="b2" label="Story" error="Too long" />
        <SelectField
          id="c"
          label="Pick"
          hint="One of these"
          error="Pick one"
          value="x"
          onValueChange={vi.fn()}
          options={[{ value: "x", label: "X" }]}
        />
        <SelectField
          id="d"
          label="Plain"
          value="y"
          onValueChange={vi.fn()}
          options={[{ value: "y", label: "Y" }]}
        />
        <RadioGroup
          id="e"
          name="e"
          legend="Size"
          value="s"
          onValueChange={vi.fn()}
          options={[{ value: "s", label: "Small", hint: "Under 50" }]}
        />
        <CheckGroup
          id="f"
          name="f"
          legend="Extras"
          value={[]}
          onValueChange={vi.fn()}
          options={[{ value: "z", label: "Z" }]}
        />
      </form>,
    );
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Your name Required");
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Notes")).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText("Story")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Pick")).toHaveAccessibleDescription("One of these Pick one");
    expect(screen.getByLabelText("Plain")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("Under 50")).toBeInTheDocument();
    await expectAccessible(container);
  });
});
