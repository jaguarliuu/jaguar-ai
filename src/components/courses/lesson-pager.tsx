import Link from "next/link";
import type { CourseLessonLink } from "@/lib/content";

type LessonPagerProps = {
  prev: CourseLessonLink | null;
  next: CourseLessonLink | null;
};

function LessonPagerLink({
  direction,
  lesson,
}: {
  direction: "Previous" | "Next";
  lesson: CourseLessonLink;
}) {
  const alignClass = direction === "Next" ? "md:text-right md:items-end" : "md:items-start";

  return (
    <Link
      href={`/courses/${lesson.courseSlug}/${lesson.chapterSlug}/${lesson.slug}`}
      className={`flex h-full min-h-[160px] flex-col justify-between rounded-[20px] border border-line bg-surface p-5 transition-colors hover:border-line-strong ${alignClass}`}
    >
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{direction}</p>
        <h3 className="mt-3 font-serif text-[1.4rem] font-semibold tracking-tight">{lesson.title}</h3>
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
        {lesson.chapterSlug} / {lesson.slug}
      </p>
    </Link>
  );
}

export function LessonPager({ prev, next }: LessonPagerProps) {
  if (!prev && !next) {
    return null;
  }

  return (
    <nav className="grid gap-4 border-t border-line pt-8 md:grid-cols-2">
      <div>{prev ? <LessonPagerLink direction="Previous" lesson={prev} /> : null}</div>
      <div>{next ? <LessonPagerLink direction="Next" lesson={next} /> : null}</div>
    </nav>
  );
}
