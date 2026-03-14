import { renderToStaticMarkup } from "react-dom/server";
import { buildTableOfContents } from "@/lib/toc";
import { renderMdx } from "@/lib/mdx";

describe("renderMdx", () => {
  it("renders headings with anchor ids", async () => {
    const result = await renderMdx("# Heading");
    const html = renderToStaticMarkup(result.content);

    expect(html).toContain('id="heading"');
  });
});

describe("buildTableOfContents", () => {
  it("extracts level two and three headings", () => {
    const items = buildTableOfContents(`
# Title

## Overview

### Details

#### Ignore
`);

    expect(items).toEqual([
      { depth: 2, slug: "overview", title: "Overview" },
      { depth: 3, slug: "details", title: "Details" },
    ]);
  });
});
