import Link from "next/link";
import type { Course } from "@/lib/content";

type CourseOutlineProps = {
  course: Course;
  currentChapterSlug?: string;
  currentSectionSlug?: string;
};

export function CourseOutline({
  course,
  currentChapterSlug,
  currentSectionSlug,
}: CourseOutlineProps) {
  return (
    <div className="space-y-6">
      {course.chapters.map((chapter, index) => {
        const isCurrentChapter = chapter.slug === currentChapterSlug;

        return (
          <section key={chapter.slug}>
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                  Chapter {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-serif text-[1.35rem] font-semibold tracking-tight">
                  <Link
                    href={`/courses/${course.slug}/${chapter.slug}`}
                    className={isCurrentChapter ? "text-foreground" : "text-foreground/90"}
                  >
                    {chapter.title}
                  </Link>
                </h3>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                {chapter.sections.length} lessons
              </span>
            </div>

            <ol className="mt-4 space-y-3">
              {chapter.sections.map((section, sectionIndex) => {
                const isCurrentSection = section.slug === currentSectionSlug;

                return (
                  <li key={section.slug}>
                    <Link
                      href={`/courses/${course.slug}/${chapter.slug}/${section.slug}`}
                      className={`grid gap-1 rounded-2xl border px-4 py-3 transition-colors ${
                        isCurrentSection
                          ? "border-line-strong bg-soft"
                          : "border-line bg-surface hover:border-line-strong"
                      }`}
                    >
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                        Lesson {String(sectionIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm leading-6 text-foreground">{section.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
