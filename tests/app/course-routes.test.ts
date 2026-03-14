import { generateStaticParams as generateSectionParams } from "@/app/courses/[courseSlug]/[chapterSlug]/[sectionSlug]/page";
import { getCourseBySlug } from "@/lib/content/courses";

describe("course routes", () => {
  it("provides previous and next lesson context", async () => {
    const course = await getCourseBySlug("prompt-engineering");
    const firstSection = course?.chapters[0].sections[0];

    expect(firstSection?.next?.slug).toBe("zero-shot-and-few-shot");
    expect(firstSection?.prev).toBeNull();
  });

  it("exposes nested static params for lessons", async () => {
    expect(await generateSectionParams()).toContainEqual({
      courseSlug: "prompt-engineering",
      chapterSlug: "foundations",
      sectionSlug: "what-is-prompt-engineering",
    });
  });
});
