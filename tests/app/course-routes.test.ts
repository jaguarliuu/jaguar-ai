import { generateStaticParams as generateSectionParams } from "@/app/courses/[courseSlug]/[chapterSlug]/[sectionSlug]/page";
import { getCourseBySlug } from "@/lib/content/courses";

describe("course routes", () => {
  it("provides previous and next lesson context", async () => {
    const course = await getCourseBySlug("miniclaw");
    const firstSection = course?.chapters[0].sections[0];

    expect(firstSection?.slug).toBe("openclaw-phenomenon");
    expect(firstSection?.next?.slug).toBe("dev-env");
    expect(firstSection?.prev).toBeNull();
  });

  it("exposes nested static params for lessons", async () => {
    expect(await generateSectionParams()).toContainEqual({
      courseSlug: "miniclaw",
      chapterSlug: "chapter-03",
      sectionSlug: "dev-env",
    });
  });
});
