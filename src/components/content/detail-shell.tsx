import type { ReactNode } from "react";
import { Container } from "@/components/site/container";
import { ContentTableOfContents } from "@/components/content/toc";
import type { TocItem } from "@/lib/toc";
import { Prose } from "./prose";
import { MetadataStrip, type MetadataStripItem } from "./metadata-strip";

type DetailShellProps = {
  kicker: string;
  title: string;
  summary: string;
  metadata: MetadataStripItem[];
  tocItems: TocItem[];
  children: ReactNode;
};

export function DetailShell({
  kicker,
  title,
  summary,
  metadata,
  tocItems,
  children,
}: DetailShellProps) {
  return (
    <Container className="py-14 md:py-20">
      <div className="max-w-4xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">{kicker}</p>
        <h1 className="mt-4 font-serif text-[2.7rem] font-semibold leading-[0.98] tracking-[-0.04em] md:text-[4.4rem]">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-[15px] leading-8 text-muted md:text-lg">{summary}</p>
      </div>

      <div className="mt-10">
        <MetadataStrip items={metadata} />
      </div>

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start">
        <div className="min-w-0">
          <Prose>{children}</Prose>
        </div>
        <div className="hidden xl:block">
          <ContentTableOfContents items={tocItems} />
        </div>
      </div>
    </Container>
  );
}
