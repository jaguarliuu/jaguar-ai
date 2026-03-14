import path from "node:path";
import { dailySchema, type DailyIssue } from "./types";
import { listContentFiles, readValidatedMdx, resolveContentFile, sortByDateDesc } from "./shared";

async function loadIssue(filePath: string): Promise<DailyIssue> {
  const { body, frontmatter } = await readValidatedMdx(filePath, dailySchema);

  return {
    ...frontmatter,
    body,
  };
}

export async function getAllDailyIssues() {
  const files = await listContentFiles("daily/*.{md,mdx}");
  const issues = await Promise.all(files.map(loadIssue));
  return sortByDateDesc(issues);
}

export async function getAllDailySlugs() {
  const issues = await getAllDailyIssues();
  return issues.map((issue) => issue.slug);
}

export async function getDailyIssueBySlug(slug: string) {
  try {
    const filePath = await resolveContentFile(path.join(process.cwd(), "content", "daily", slug));
    return await loadIssue(filePath);
  } catch {
    return null;
  }
}
