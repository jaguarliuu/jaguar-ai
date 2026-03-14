import type { TocItem } from "@/lib/toc";

type ContentTableOfContentsProps = {
  items: TocItem[];
  className?: string;
};

export function ContentTableOfContents({ items, className }: ContentTableOfContentsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside
      className={[
        "max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">On this page</p>
      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={`${item.slug}-${index}`}>
            <a
              href={`#${item.slug}`}
              className={`block text-sm leading-6 text-foreground transition-colors hover:text-muted ${
                item.depth === 3 ? "pl-4 text-muted" : ""
              }`}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
