import { renderToStaticMarkup } from "react-dom/server";
import { getCourseSectionBySlug } from "@/lib/content";
import { buildTableOfContents } from "@/lib/toc";
import { renderMdx } from "@/lib/mdx";

describe("renderMdx", () => {
  it("renders headings with anchor ids", async () => {
    const result = await renderMdx("# Heading");
    const html = renderToStaticMarkup(result.content);

    expect(html).toContain('id="heading"');
  });

  it("renders fenced code blocks with syntax highlighting markup", async () => {
    const result = await renderMdx("```ts\nconst value = 1;\n```");
    const html = renderToStaticMarkup(result.content);

    expect(html).toContain('data-language="ts"');
  });

  it("renders course content with literal less-than text", async () => {
    const section = await getCourseSectionBySlug("miniclaw", "chapter-04", "llm-sync");
    const result = await renderMdx(section?.body ?? "");
    const html = renderToStaticMarkup(result.content);

    expect(html).toContain("&lt;100字");
  });

  it("renders course content with inline json prose", async () => {
    const section = await getCourseSectionBySlug("miniclaw", "chapter-04", "structured-output");
    const result = await renderMdx(section?.body ?? "");
    const html = renderToStaticMarkup(result.content);

    expect(html).toContain("publish_date");
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
