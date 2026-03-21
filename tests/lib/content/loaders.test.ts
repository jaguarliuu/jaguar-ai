import { getCourseBySlug } from "@/lib/content/courses";
import { getAllDailyIssues } from "@/lib/content/daily";

describe("content loaders", () => {
  it("loads daily issues in descending date order", async () => {
    const issues = await getAllDailyIssues();

    expect(issues.slice(0, 3).map((issue) => issue.slug)).toEqual([
      "2026-03-14",
      "2026-03-13",
      "2026-03-12",
    ]);
    expect(issues[0]?.slug).toBe("2026-03-14");
    expect(issues[0]?.topic).toBeTruthy();
  });

  it("builds the nested course tree from markdown chapter files", async () => {
    const course = await getCourseBySlug("miniclaw");

    expect(course?.slug).toBe("miniclaw");
    expect(course?.chapters.map((chapter) => chapter.slug)).toEqual([
      "chapter-01",
      "chapter-03",
      "chapter-04",
      "chapter-05",
    ]);
    expect(course?.chapters[0].sections[0].slug).toBe("openclaw-phenomenon");
    expect(course?.chapters[1].sections[0].slug).toBe("dev-env");
    expect(course?.chapters[2].sections[0].slug).toBe("llm-architecture");
    expect(course?.chapters[3].sections[0].slug).toBe("why-websocket");
  });
});
