import { MetadataStrip, type MetadataStripItem } from "@/components/content/metadata-strip";

type CourseHeaderProps = {
  eyebrow: string;
  title: string;
  summary: string;
  metadata?: MetadataStripItem[];
};

export function CourseHeader({
  eyebrow,
  title,
  summary,
  metadata = [],
}: CourseHeaderProps) {
  return (
    <header className="max-w-4xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">{eyebrow}</p>
      <h1 className="mt-4 font-serif text-[2.7rem] font-semibold leading-[0.98] tracking-[-0.04em] md:text-[4.4rem]">
        {title}
      </h1>
      <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">{summary}</p>
      {metadata.length ? (
        <div className="mt-8">
          <MetadataStrip items={metadata} />
        </div>
      ) : null}
    </header>
  );
}
