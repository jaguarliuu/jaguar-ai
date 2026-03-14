import Link from "next/link";
import type { CourseChapter } from "@/lib/content";

type ChapterListProps = {
  courseSlug: string;
  chapter: CourseChapter;
};

export function ChapterList({ courseSlug, chapter }: ChapterListProps) {
  return (
    <div className="space-y-4">
      {chapter.sections.map((section, index) => (
        <article
          key={section.slug}
          className="rounded-[20px] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            Lesson {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="mt-3 font-serif text-[1.6rem] font-semibold tracking-tight">
            <Link href={`/courses/${courseSlug}/${chapter.slug}/${section.slug}`}>{section.title}</Link>
          </h3>
          <p className="mt-3 text-sm leading-7 text-muted md:text-[15px]">{section.summary}</p>
        </article>
      ))}
    </div>
  );
}
