import type { Metadata } from "next";
import { ArchiveList } from "@/components/content/archive-list";
import { Container } from "@/components/site/container";
import { getAllCourses } from "@/lib/content";

export const metadata: Metadata = {
  title: "Courses",
  description: "JaguarAI public courses.",
};

function countLessons(course: { chapters: Array<{ sections: unknown[] }> }) {
  return course.chapters.reduce((total, chapter) => total + chapter.sections.length, 0);
}

export default async function CoursesPage() {
  const courses = await getAllCourses();

  return (
    <Container className="py-14 md:py-20">
      <header className="max-w-4xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Public Course Index</p>
        <h1 className="mt-4 font-serif text-[2.8rem] font-semibold tracking-[-0.04em] md:text-[4.4rem]">
          Courses
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">
          课程以公开、章节化、全文可读的方式维护，适合从索引页一路进入具体章节与小节。
        </p>
      </header>

      <div className="mt-10">
        <ArchiveList
          items={courses.map((course) => ({
            href: `/courses/${course.slug}`,
            title: course.title,
            summary: course.summary,
            meta: [
              course.series,
              `${course.chapters.length} chapters`,
              `${countLessons(course)} lessons`,
            ],
          }))}
        />
      </div>
    </Container>
  );
}
