import Link from "next/link";
import type { Course } from "@/lib/content";
import { CourseOutline } from "./course-outline";

type CourseSidebarProps = {
  course: Course;
  currentChapterSlug?: string;
  currentSectionSlug?: string;
};

export function CourseSidebar({
  course,
  currentChapterSlug,
  currentSectionSlug,
}: CourseSidebarProps) {
  return (
    <aside className="sticky top-24 rounded-[22px] border border-line bg-surface p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">Course</p>
      <h2 className="mt-3 font-serif text-[1.75rem] font-semibold tracking-tight">
        <Link href={`/courses/${course.slug}`}>{course.title}</Link>
      </h2>
      <p className="mt-3 text-sm leading-7 text-muted">{course.summary}</p>

      <div className="mt-6">
        <CourseOutline
          course={course}
          currentChapterSlug={currentChapterSlug}
          currentSectionSlug={currentSectionSlug}
        />
      </div>
    </aside>
  );
}
