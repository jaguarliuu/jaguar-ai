import Link from "next/link";
import type { ProjectEntry } from "@/lib/content";

type ProjectListProps = {
  projects: ProjectEntry[];
};

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <article
          key={project.slug}
          className="rounded-[20px] border border-line bg-surface p-5 transition-colors hover:border-line-strong md:p-6"
        >
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            <span>{project.kind}</span>
            <span>/</span>
            <span>{project.stage}</span>
          </div>
          <h2 className="mt-4 font-serif text-[1.9rem] font-semibold tracking-tight">
            <Link href={`/projects/${project.slug}`}>{project.title}</Link>
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted md:text-[15px]">{project.summary}</p>
        </article>
      ))}
    </div>
  );
}
