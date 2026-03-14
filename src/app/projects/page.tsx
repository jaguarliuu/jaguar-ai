import type { Metadata } from "next";
import { Container } from "@/components/site/container";
import { ProjectList } from "@/components/projects/project-list";
import { getAllProjects } from "@/lib/content";

export const metadata: Metadata = {
  title: "Projects",
  description: "JaguarAI maintained projects.",
};

export default async function ProjectsPage() {
  const projects = await getAllProjects();

  return (
    <Container className="py-14 md:py-20">
      <header className="max-w-4xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Maintained Work</p>
        <h1 className="mt-4 font-serif text-[2.8rem] font-semibold tracking-[-0.04em] md:text-[4.4rem]">
          Projects
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">
          这里集中展示已经在维护的产品和开源项目，强调其定位、状态和长期迭代方向。
        </p>
      </header>

      <div className="mt-10">
        <ProjectList projects={projects} />
      </div>
    </Container>
  );
}
