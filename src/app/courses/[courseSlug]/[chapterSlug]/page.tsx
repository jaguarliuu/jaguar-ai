import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Prose } from "@/components/content/prose";
import { Container } from "@/components/site/container";
import { ChapterList } from "@/components/courses/chapter-list";
import { CourseHeader } from "@/components/courses/course-header";
import { getAllCourses, getCourseBySlug } from "@/lib/content";
import { renderMdx } from "@/lib/mdx";

type CourseChapterPageProps = {
  params: Promise<{
    courseSlug: string;
    chapterSlug: string;
  }>;
};

export async function generateStaticParams() {
  const courses = await getAllCourses();

  return courses.flatMap((course) =>
    course.chapters.map((chapter) => ({
      courseSlug: course.slug,
      chapterSlug: chapter.slug,
    })),
  );
}

export async function generateMetadata({
  params,
}: CourseChapterPageProps): Promise<Metadata> {
  const { courseSlug, chapterSlug } = await params;
  const course = await getCourseBySlug(courseSlug);
  const chapter = course?.chapters.find((entry) => entry.slug === chapterSlug);

  if (!course || !chapter) {
    return {};
  }

  return {
    title: `${chapter.title} | ${course.title}`,
    description: chapter.summary,
  };
}

export default async function CourseChapterPage({ params }: CourseChapterPageProps) {
  const { courseSlug, chapterSlug } = await params;
  const course = await getCourseBySlug(courseSlug);
  const chapter = course?.chapters.find((entry) => entry.slug === chapterSlug);

  if (!course || !chapter) {
    notFound();
  }

  const rendered = await renderMdx(chapter.body);

  return (
    <Container className="py-14 md:py-20">
      <CourseHeader
        eyebrow={`Course / ${course.title}`}
        title={chapter.title}
        summary={chapter.summary}
        metadata={[
          { label: "Course", value: course.title },
          { label: "Lessons", value: String(chapter.sections.length) },
          { label: "Duration", value: chapter.duration ?? "Self-paced" },
        ]}
      />

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0">
          <Prose>{rendered.content}</Prose>
        </div>
        <aside>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
            Chapter Lessons
          </p>
          <ChapterList courseSlug={course.slug} chapter={chapter} />
        </aside>
      </div>
    </Container>
  );
}
