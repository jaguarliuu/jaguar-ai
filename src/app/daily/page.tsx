import type { Metadata } from "next";
import { ArchiveList } from "@/components/content/archive-list";
import { Container } from "@/components/site/container";
import { getAllDailyIssues } from "@/lib/content/daily";

export const metadata: Metadata = {
  title: "Daily",
  description: "JaguarAI AI daily issue archive.",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export default async function DailyPage() {
  const issues = await getAllDailyIssues();

  return (
    <Container className="py-14 md:py-20">
      <header className="max-w-4xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">AI Briefing Archive</p>
        <h1 className="mt-4 font-serif text-[2.8rem] font-semibold tracking-[-0.04em] md:text-[4.4rem]">
          Daily
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">
          外部日报 Agent 每日通过 Git 推送更新，这里只负责归档、浏览与长期留存。
        </p>
      </header>

      <div className="mt-10">
        <ArchiveList
          items={issues.map((issue) => ({
            href: `/daily/${issue.slug}`,
            title: issue.title,
            summary: issue.summary,
            meta: [`Issue ${issue.issue}`, formatDate(issue.date), issue.topic ?? "AI"],
          }))}
        />
      </div>
    </Container>
  );
}
