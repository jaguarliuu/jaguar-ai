import Link from "next/link";

export type ContentPreviewItem = {
  href: string;
  kicker: string;
  title: string;
  summary: string;
  meta?: string;
  footer?: string;
};

type ContentPreviewGridProps = {
  items: ContentPreviewItem[];
  columns?: 1 | 2 | 3;
};

const columnClassNames = {
  1: "grid-cols-1",
  2: "grid-cols-1 lg:grid-cols-2",
  3: "grid-cols-1 lg:grid-cols-3",
} as const;

export function ContentPreviewGrid({
  items,
  columns = 2,
}: ContentPreviewGridProps) {
  return (
    <div className={`grid gap-6 pt-8 ${columnClassNames[columns]}`}>
      {items.map((item) => (
        <article
          key={item.href}
          className="flex h-full flex-col justify-between rounded-[20px] border border-line bg-surface p-5 md:p-6"
        >
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-line pb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              <span>{item.kicker}</span>
              {item.meta ? <span>{item.meta}</span> : null}
            </div>
            <h3 className="mt-5 font-serif text-[1.75rem] font-semibold leading-tight tracking-tight">
              <Link href={item.href} className="transition-colors hover:text-muted">
                {item.title}
              </Link>
            </h3>
            <p className="mt-4 text-sm leading-7 text-muted md:text-[15px]">{item.summary}</p>
          </div>
          {item.footer ? (
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              {item.footer}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
