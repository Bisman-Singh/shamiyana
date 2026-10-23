import { renderToStaticMarkup } from "react-dom/server";
import GlobalError from "@/app/global-error";

describe("global error page", () => {
  it("stands alone with its own document, in both languages, with a way to retry", () => {
    const html = renderToStaticMarkup(<GlobalError reset={vi.fn()} />);
    expect(html).toMatch(/^<html lang="en"><head><\/head><body><main id="main"/);
    expect(html).toContain("<h1>Something went wrong</h1>");
    expect(html).toContain('<p lang="hi">');
    expect(html).toContain('<button type="button" class="btn btn-primary">Try again');
  });
});
