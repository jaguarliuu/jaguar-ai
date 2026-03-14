import { render, screen } from "@testing-library/react";
import { ContentTableOfContents } from "@/components/content/toc";

describe("ContentTableOfContents", () => {
  it("allows the toc rail to receive layout classes", () => {
    render(
      <ContentTableOfContents
        className="hidden xl:block xl:sticky xl:top-24 xl:self-start"
        items={[
          { depth: 2, slug: "overview", title: "Overview" },
          { depth: 3, slug: "details", title: "Details" },
        ]}
      />,
    );

    expect(screen.getByText("On this page").closest("aside")).toHaveClass(
      "hidden",
      "xl:block",
      "xl:sticky",
      "xl:top-24",
      "xl:self-start",
    );
  });
});
