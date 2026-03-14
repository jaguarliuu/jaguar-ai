import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailShell } from "@/components/content/detail-shell";
import { getAllDailySlugs, getDailyIssueBySlug } from "@/lib/content/daily";
import { renderMdx } from "@/lib/mdx";
import { buildTableOfContents } from "@/lib/toc";

type DailyDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export async function generateStaticParams() {
  return (await getAllDailySlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: DailyDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getDailyIssueBySlug(slug);

  if (!issue) {
    return {};
  }

  return {
    title: issue.title,
    description: issue.summary,
  };
}

export default async function DailyDetailPage({ params }: DailyDetailPageProps) {
  const { slug } = await params;
  const issue = await getDailyIssueBySlug(slug);

  if (!issue) {
    notFound();
  }

  const rendered = await renderMdx(issue.body);

  return (
    <DetailShell
      kicker={`Daily / Issue ${issue.issue}`}
      title={issue.title}
      summary={issue.summary}
      metadata={[
        { label: "Published", value: formatDate(issue.date) },
        { label: "Topic", value: issue.topic ?? "AI" },
        { label: "Sources", value: issue.sources.length ? `${issue.sources.length} links` : "None" },
      ]}
      tocItems={buildTableOfContents(issue.body)}
    >
      {rendered.content}
    </DetailShell>
  );
}
