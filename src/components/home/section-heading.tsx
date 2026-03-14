import Link from "next/link";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
};

export function SectionHeading({ eyebrow, title, description, href }: SectionHeadingProps) {
  return (
    <div className="grid gap-5 border-b border-line pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">{eyebrow}</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted md:text-[15px]">{description}</p>
      </div>
      <div>
        <Link
          href={href}
          className="inline-flex items-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted transition-colors hover:text-foreground"
        >
          View all
        </Link>
      </div>
    </div>
  );
}
