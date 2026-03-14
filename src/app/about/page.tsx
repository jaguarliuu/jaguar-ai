import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Prose } from "@/components/content/prose";
import { Container } from "@/components/site/container";
import { getSitePageBySlug } from "@/lib/content";
import { renderMdx } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "About",
  description: "About Jaguar and JaguarAI.",
};

export default async function AboutPage() {
  const page = await getSitePageBySlug("about");

  if (!page) {
    notFound();
  }

  const rendered = await renderMdx(page.body);

  return (
    <Container className="py-14 md:py-20">
      <header className="max-w-4xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Brand Profile</p>
        <h1 className="mt-4 font-serif text-[2.8rem] font-semibold tracking-[-0.04em] md:text-[4.4rem]">
          关于 Jaguar
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">{page.summary}</p>
      </header>

      <div className="mt-10 max-w-4xl">
        <Prose>{rendered.content}</Prose>
      </div>
    </Container>
  );
}
