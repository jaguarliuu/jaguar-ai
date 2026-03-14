import { readdir } from "node:fs/promises";
import { projectSchema, type ProjectEntry } from "./types";
import { contentPath, readValidatedMdx, sortByDateDesc } from "./shared";

async function loadProject(projectSlug: string): Promise<ProjectEntry> {
  const { body, frontmatter } = await readValidatedMdx(
    contentPath("projects", projectSlug, "index.mdx"),
    projectSchema,
  );

  return {
    ...frontmatter,
    body,
  };
}

export async function getAllProjects() {
  const entries = await readdir(contentPath("projects"), { withFileTypes: true });
  const projectSlugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const projects = await Promise.all(projectSlugs.map(loadProject));
  return sortByDateDesc(projects);
}

export async function getProjectBySlug(slug: string) {
  try {
    return await loadProject(slug);
  } catch {
    return null;
  }
}
