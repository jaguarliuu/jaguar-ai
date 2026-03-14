export type MetadataStripItem = {
  label: string;
  value: string;
};

type MetadataStripProps = {
  items: MetadataStripItem[];
};

export function MetadataStrip({ items }: MetadataStripProps) {
  return (
    <dl className="grid gap-4 border-y border-line py-4 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <dt className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">{item.label}</dt>
          <dd className="text-sm text-foreground md:text-[15px]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
