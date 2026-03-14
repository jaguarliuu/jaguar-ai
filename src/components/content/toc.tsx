import type { TocItem } from "@/lib/toc";

type ContentTableOfContentsProps = {
  items: TocItem[];
};

export function ContentTableOfContents({ items }: ContentTableOfContentsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">On this page</p>
      <ol className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.slug}>
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
