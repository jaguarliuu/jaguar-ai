import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { z } from "zod";

export const CONTENT_ROOT = path.join(process.cwd(), "content");

export async function listContentFiles(patterns: string | string[]) {
  return fg(patterns, {
    cwd: CONTENT_ROOT,
    absolute: true,
    onlyFiles: true,
  });
}

export async function readValidatedMdx<TSchema extends z.ZodTypeAny>(
  filePath: string,
  schema: TSchema,
) {
  const source = await readFile(filePath, "utf8");
  const parsed = matter(source);

  return {
    body: parsed.content.trim(),
    frontmatter: schema.parse(parsed.data),
  };
}

export function sortByDateDesc<T extends { date: string }>(items: T[]) {
  return [...items].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  );
}

export function sortByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((left, right) => left.order - right.order);
}

export function contentPath(...segments: string[]) {
  return path.join(CONTENT_ROOT, ...segments);
}
