import { z } from "zod";

function normalizeFrontmatterString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function normalizeOptionalFrontmatterString(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return normalizeFrontmatterString(value);
}

const stringField = z.preprocess(normalizeFrontmatterString, z.string());
const dateField = z.preprocess(
  normalizeFrontmatterString,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
);
const optionalStringField = z.preprocess(
  normalizeOptionalFrontmatterString,
  z.string().optional(),
);
const optionalUrlField = z.preprocess(
  normalizeOptionalFrontmatterString,
  z.string().url().optional(),
);

export const baseSchema = z.object({
  title: stringField,
  summary: stringField,
  slug: stringField,
  date: dateField,
  tags: z.array(z.string()).default([]),
  status: optionalStringField,
  cover: optionalStringField,
});

export const postSchema = baseSchema;

export const dailySchema = baseSchema.extend({
  issue: z.number(),
  topic: optionalStringField,
  sources: z.array(z.string()).default([]),
});

export const courseSchema = baseSchema.extend({
  series: stringField,
  order: z.number(),
  duration: optionalStringField,
});

export const courseChapterSchema = baseSchema.extend({
  order: z.number(),
  duration: optionalStringField,
});

export const courseSectionSchema = baseSchema.extend({
  order: z.number(),
});

export const projectSchema = baseSchema.extend({
  kind: stringField,
  stage: stringField,
  repo: optionalUrlField,
  demo: optionalUrlField,
});

export const sitePageSchema = z.object({
  title: stringField,
  summary: stringField,
  slug: stringField,
});

type WithBody<T> = T & {
  body: string;
};

export type PostEntry = WithBody<z.infer<typeof postSchema>>;
export type DailyIssue = WithBody<z.infer<typeof dailySchema>>;
export type CourseReference = {
  slug: string;
  title: string;
};
export type CourseChapterReference = {
  slug: string;
  title: string;
};
export type CourseLessonLink = {
  courseSlug: string;
  chapterSlug: string;
  slug: string;
  title: string;
};
export type CourseSection = WithBody<z.infer<typeof courseSectionSchema>> & {
  courseSlug: string;
  chapterSlug: string;
  course: CourseReference;
  chapter: CourseChapterReference;
  prev: CourseLessonLink | null;
  next: CourseLessonLink | null;
};
export type CourseChapter = WithBody<z.infer<typeof courseChapterSchema>> & {
  courseSlug: string;
  sections: CourseSection[];
};
export type Course = WithBody<z.infer<typeof courseSchema>> & {
  chapters: CourseChapter[];
};
export type ProjectEntry = WithBody<z.infer<typeof projectSchema>>;
export type SitePage = WithBody<z.infer<typeof sitePageSchema>>;
