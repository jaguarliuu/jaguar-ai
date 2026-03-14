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
    <div className="space-y-3">
      {course.chapters.map((chapter, index) => {
        const isCurrentChapter = chapter.slug === currentChapterSlug;
        const isOpenByDefault = isCurrentChapter || (!currentChapterSlug && index === 0);

        return (
          <details
            key={chapter.slug}
            open={isOpenByDefault}
            className="group rounded-[20px] border border-line bg-white/70 p-4"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                  Chapter {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-serif text-[1.2rem] font-semibold tracking-tight">
                  <Link
                    href={`/courses/${course.slug}/${chapter.slug}`}
                    className={isCurrentChapter ? "text-foreground" : "text-foreground/90"}
                  >
                    {chapter.title}
                  </Link>
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                  {chapter.sections.length} lessons
                </span>
                <span className="font-mono text-lg leading-none text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </div>
            </summary>

            <ol className="mt-4 space-y-3 border-t border-line pt-4">
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
          </details>
        );
      })}
    </div>
  );
}
