import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Prose } from "@/components/content/prose";
import { Container } from "@/components/site/container";
import { ProjectFacts, type ProjectFactItem } from "@/components/projects/project-facts";
import { getAllProjects, getProjectBySlug } from "@/lib/content";
import { renderMdx } from "@/lib/mdx";

type ProjectDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return (await getAllProjects()).map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: ProjectDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) {
    return {};
  }

  return {
    title: project.title,
    description: project.summary,
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  const rendered = await renderMdx(project.body);
  const facts: ProjectFactItem[] = [
    { label: "Kind", value: project.kind },
    { label: "Stage", value: project.stage },
    { label: "Date", value: project.date },
  ];

  if (project.repo) {
    facts.push({ label: "Repository", value: project.repo, href: project.repo });
  }

  if (project.demo) {
    facts.push({ label: "Demo", value: project.demo, href: project.demo });
  }

  return (
    <Container className="py-14 md:py-20">
      <header className="max-w-4xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Project Dossier</p>
        <h1 className="mt-4 font-serif text-[2.8rem] font-semibold tracking-[-0.04em] md:text-[4.4rem]">
          {project.title}
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">{project.summary}</p>
      </header>

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div className="min-w-0">
          <Prose>{rendered.content}</Prose>
        </div>
        <ProjectFacts items={facts} />
      </div>
    </Container>
  );
}
