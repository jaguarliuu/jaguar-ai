import type { Metadata } from "next";
import { ArchiveList } from "@/components/content/archive-list";
import { Container } from "@/components/site/container";
import { getAllPosts } from "@/lib/content/posts";

export const metadata: Metadata = {
  title: "Posts",
  description: "JaguarAI long-form posts archive.",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export default async function PostsPage() {
  const posts = await getAllPosts();

  return (
    <Container className="py-14 md:py-20">
      <header className="max-w-4xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Writing Archive</p>
        <h1 className="mt-4 font-serif text-[2.8rem] font-semibold tracking-[-0.04em] md:text-[4.4rem]">
          Posts
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">
          围绕 AI 工程、Agent 工作流、内容系统与方法论的长期写作。
        </p>
      </header>

      <div className="mt-10">
        <ArchiveList
          items={posts.map((post) => ({
            href: `/posts/${post.slug}`,
            title: post.title,
            summary: post.summary,
            meta: [formatDate(post.date), ...post.tags],
          }))}
        />
      </div>
    </Container>
  );
}
