import path from "node:path";
import { dailySchema, type DailyIssue } from "./types";
import { listContentFiles, readValidatedMdx, sortByDateDesc } from "./shared";

async function loadIssue(filePath: string): Promise<DailyIssue> {
  const { body, frontmatter } = await readValidatedMdx(filePath, dailySchema);

  return {
    ...frontmatter,
    body,
  };
}

export async function getAllDailyIssues() {
  const files = await listContentFiles("daily/*.mdx");
  const issues = await Promise.all(files.map(loadIssue));
  return sortByDateDesc(issues);
}

export async function getAllDailySlugs() {
  const issues = await getAllDailyIssues();
  return issues.map((issue) => issue.slug);
}

export async function getDailyIssueBySlug(slug: string) {
  const filePath = path.join(process.cwd(), "content", "daily", `${slug}.mdx`);

  try {
    return await loadIssue(filePath);
  } catch {
    return null;
  }
}
