import { getCourseBySlug } from "@/lib/content/courses";
import { getAllDailyIssues } from "@/lib/content/daily";

describe("content loaders", () => {
  it("loads daily issues in descending date order", async () => {
    const issues = await getAllDailyIssues();

    expect(issues.slice(0, 2).map((issue) => issue.slug)).toEqual([
      "2026-03-14",
      "2026-03-13",
    ]);
  });

  it("builds the nested course tree from directories", async () => {
    const course = await getCourseBySlug("prompt-engineering");

    expect(course?.chapters[0].slug).toBe("foundations");
    expect(course?.chapters[0].sections[0].slug).toBe("what-is-prompt-engineering");
  });
});
