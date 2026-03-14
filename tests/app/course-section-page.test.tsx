import { render, screen } from "@testing-library/react";
import CourseSectionPage from "@/app/courses/[courseSlug]/[chapterSlug]/[sectionSlug]/page";

describe("CourseSectionPage", () => {
  it("renders the page toc as a sticky grid rail", async () => {
    render(
      await CourseSectionPage({
        params: Promise.resolve({
          courseSlug: "miniclaw",
          chapterSlug: "chapter-03",
          sectionSlug: "dev-env",
        }),
      }),
    );

    const aside = screen.getByText("On this page").closest("aside");

    expect(aside).not.toBeNull();
    expect(aside?.parentElement).toHaveClass("grid");
    expect(aside).toHaveClass("xl:sticky", "xl:top-24", "xl:self-start");
  });

  it("renders course code blocks with copy actions", async () => {
    render(
      await CourseSectionPage({
        params: Promise.resolve({
          courseSlug: "miniclaw",
          chapterSlug: "chapter-03",
          sectionSlug: "dev-env",
        }),
      }),
    );

    expect(screen.getAllByRole("button", { name: "Copy code" }).length).toBeGreaterThan(0);
  });
});
