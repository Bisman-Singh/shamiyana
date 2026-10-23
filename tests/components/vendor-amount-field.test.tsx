// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { VendorAmountField } from "@/components/planner/vendors/vendor-amount-field";
import { renderIn } from "../helpers/render";

/** The field with its amount held in state, and a button that changes it from elsewhere, as another tab would. */
function Harness() {
  const [rupees, setRupees] = useState(0);
  return (
    <>
      <VendorAmountField
        id="quote"
        label="Agreed price"
        value={rupees}
        onAmountChange={setRupees}
      />
      <p>Saved {rupees}</p>
      <button
        type="button"
        onClick={() => {
          setRupees(4_000);
        }}
      >
        Change elsewhere
      </button>
    </>
  );
}

describe("VendorAmountField", () => {
  it("keeps the typed text for its own saves and shows a change made elsewhere", async () => {
    renderIn(<Harness />);
    const field = screen.getByLabelText("Agreed price");
    await userEvent.type(field, "₹2,500");
    expect(field).toHaveValue("₹2,500");
    expect(screen.getByText("Saved 2500")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change elsewhere" }));
    expect(field).toHaveValue("4000");
    expect(field).not.toHaveAttribute("aria-invalid");
  });
});
