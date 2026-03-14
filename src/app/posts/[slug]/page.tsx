import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailShell } from "@/components/content/detail-shell";
import { renderMdx } from "@/lib/mdx";
import { buildTableOfContents } from "@/lib/toc";
import { getAllPostSlugs, getPostBySlug } from "@/lib/content/posts";

type PostDetailPageProps = {
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
  return (await getAllPostSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PostDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {};
  }

  return {
    title: post.title,
    description: post.summary,
  };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const rendered = await renderMdx(post.body);

  return (
    <DetailShell
      kicker="Post"
      title={post.title}
      summary={post.summary}
      metadata={[
        { label: "Published", value: formatDate(post.date) },
        { label: "Tags", value: post.tags.join(" / ") || "None" },
      ]}
      tocItems={buildTableOfContents(post.body)}
    >
      {rendered.content}
    </DetailShell>
  );
}
