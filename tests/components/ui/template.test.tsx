// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { Template } from "@/components/ui/template";

describe("Template", () => {
  it("fills placeholders with nodes in the template's own order", () => {
    const { container } = render(
      <Template text="{title} हटाएँ" values={{ title: <span lang="en">Book the DJ</span> }} />,
    );
    expect(container).toHaveTextContent("Book the DJ हटाएँ");
    expect(container.querySelector('[lang="en"]')).toHaveTextContent("Book the DJ");
  });

  it("leaves a placeholder with no value visible rather than dropping it", () => {
    const { container } = render(
      <Template text="Remove {title} from {list}" values={{ title: "tea" }} />,
    );
    expect(container).toHaveTextContent("Remove tea from {list}");
  });
});
