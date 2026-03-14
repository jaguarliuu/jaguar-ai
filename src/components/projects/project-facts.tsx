export type ProjectFactItem = {
  label: string;
  value: string;
  href?: string;
};

type ProjectFactsProps = {
  items: ProjectFactItem[];
};

export function ProjectFacts({ items }: ProjectFactsProps) {
  return (
    <dl className="rounded-[22px] border border-line bg-surface p-5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`py-4 ${index === 0 ? "pt-0" : ""} ${index === items.length - 1 ? "pb-0" : "border-b border-line"}`}
        >
          <dt className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">{item.label}</dt>
          <dd className="mt-2 text-sm text-foreground md:text-[15px]">
            {item.href ? (
              <a href={item.href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {item.value}
              </a>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
