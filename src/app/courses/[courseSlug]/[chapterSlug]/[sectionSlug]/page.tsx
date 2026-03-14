import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentTableOfContents } from "@/components/content/toc";
import { MetadataStrip } from "@/components/content/metadata-strip";
import { Prose } from "@/components/content/prose";
import { Container } from "@/components/site/container";
import { CourseHeader } from "@/components/courses/course-header";
import { CourseOutline } from "@/components/courses/course-outline";
import { CourseSidebar } from "@/components/courses/course-sidebar";
import { LessonPager } from "@/components/courses/lesson-pager";
import { getAllCourses, getCourseBySlug, getCourseSectionBySlug } from "@/lib/content";
import { renderMdx } from "@/lib/mdx";
import { buildTableOfContents } from "@/lib/toc";

type CourseSectionPageProps = {
  params: Promise<{
    courseSlug: string;
    chapterSlug: string;
    sectionSlug: string;
  }>;
};

export async function generateStaticParams() {
  const courses = await getAllCourses();

  return courses.flatMap((course) =>
    course.chapters.flatMap((chapter) =>
      chapter.sections.map((section) => ({
        courseSlug: course.slug,
        chapterSlug: chapter.slug,
        sectionSlug: section.slug,
      })),
    ),
  );
}

export async function generateMetadata({
  params,
}: CourseSectionPageProps): Promise<Metadata> {
  const { courseSlug, chapterSlug, sectionSlug } = await params;
  const section = await getCourseSectionBySlug(courseSlug, chapterSlug, sectionSlug);

  if (!section) {
    return {};
  }

  return {
    title: section.title,
    description: section.summary,
  };
}

export default async function CourseSectionPage({ params }: CourseSectionPageProps) {
  const { courseSlug, chapterSlug, sectionSlug } = await params;
  const course = await getCourseBySlug(courseSlug);
  const section = await getCourseSectionBySlug(courseSlug, chapterSlug, sectionSlug);

  if (!course || !section) {
    notFound();
  }

  const rendered = await renderMdx(section.body);
  const tocItems = buildTableOfContents(section.body);

  return (
    <Container className="py-10 md:py-14">
      <CourseHeader
        eyebrow={`Lesson / ${section.chapter.title}`}
        title={section.title}
        summary={section.summary}
        metadata={[
          { label: "Course", value: section.course.title },
          { label: "Chapter", value: section.chapter.title },
          { label: "Lesson", value: section.slug },
        ]}
      />

      <details className="mt-8 rounded-[20px] border border-line bg-surface p-5 xl:hidden">
        <summary className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
          Course outline
        </summary>
        <div className="mt-5">
          <CourseOutline
            course={course}
            currentChapterSlug={chapterSlug}
            currentSectionSlug={sectionSlug}
          />
        </div>
      </details>

      <div className="mt-8 grid gap-10 xl:grid-cols-[280px_minmax(0,1fr)_220px] xl:items-start">
        <div className="hidden xl:block">
          <CourseSidebar
            course={course}
            currentChapterSlug={chapterSlug}
            currentSectionSlug={sectionSlug}
          />
        </div>

        <div className="min-w-0">
          <MetadataStrip
            items={[
              { label: "Published", value: section.date },
              { label: "Course", value: section.course.slug },
              { label: "Chapter", value: section.chapter.slug },
            ]}
          />

          <div className="mt-8">
            <Prose>{rendered.content}</Prose>
          </div>

          <div className="mt-12">
            <LessonPager prev={section.prev} next={section.next} />
          </div>
        </div>

        <ContentTableOfContents
          className="hidden xl:block xl:sticky xl:top-24 xl:self-start"
          items={tocItems}
        />
      </div>
    </Container>
  );
}
