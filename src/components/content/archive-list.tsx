import Link from "next/link";

export type ArchiveListItem = {
  href: string;
  title: string;
  summary: string;
  meta: string[];
};

type ArchiveListProps = {
  items: ArchiveListItem[];
};

export function ArchiveList({ items }: ArchiveListProps) {
  return (
    <div className="border-y border-line">
      {items.map((item) => (
        <article
          key={item.href}
          className="grid gap-5 border-b border-line py-7 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px]"
        >
          <div>
            <h2 className="font-serif text-[1.8rem] font-semibold leading-tight tracking-tight">
              <Link href={item.href} className="transition-colors hover:text-muted">
                {item.title}
              </Link>
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted md:text-[15px]">{item.summary}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2 md:justify-end">
            {item.meta.map((entry) => (
              <span
                key={`${item.href}-${entry}`}
                className="rounded-full border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
              >
                {entry}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
