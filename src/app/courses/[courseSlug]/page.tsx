import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Prose } from "@/components/content/prose";
import { Container } from "@/components/site/container";
import { CourseHeader } from "@/components/courses/course-header";
import { CourseOutline } from "@/components/courses/course-outline";
import { getAllCourses, getCourseBySlug } from "@/lib/content";
import { renderMdx } from "@/lib/mdx";

type CoursePageProps = {
  params: Promise<{
    courseSlug: string;
  }>;
};

function countLessons(course: { chapters: Array<{ sections: unknown[] }> }) {
  return course.chapters.reduce((total, chapter) => total + chapter.sections.length, 0);
}

export async function generateStaticParams() {
  return (await getAllCourses()).map((course) => ({ courseSlug: course.slug }));
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getCourseBySlug(courseSlug);

  if (!course) {
    return {};
  }

  return {
    title: course.title,
    description: course.summary,
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params;
  const course = await getCourseBySlug(courseSlug);

  if (!course) {
    notFound();
  }

  const rendered = await renderMdx(course.body);

  return (
    <Container className="py-14 md:py-20">
      <CourseHeader
        eyebrow="Course"
        title={course.title}
        summary={course.summary}
        metadata={[
          { label: "Series", value: course.series },
          { label: "Chapters", value: String(course.chapters.length) },
          { label: "Lessons", value: String(countLessons(course)) },
        ]}
      />

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0">
          <Prose>{rendered.content}</Prose>
        </div>
        <aside className="rounded-[22px] border border-line bg-surface p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">Outline</p>
          <div className="mt-5">
            <CourseOutline course={course} />
          </div>
        </aside>
      </div>
    </Container>
  );
}
