import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  courseChapterSchema,
  courseSchema,
  courseSectionSchema,
  type Course,
  type CourseChapter,
  type CourseSection,
} from "./types";
import { contentPath, listContentFiles, readValidatedMdx, sortByOrder } from "./shared";

async function loadSections(courseSlug: string, chapterSlug: string): Promise<CourseSection[]> {
  const sectionFiles = await listContentFiles(`courses/${courseSlug}/${chapterSlug}/*.mdx`);
  const filteredSectionFiles = sectionFiles.filter((filePath) => path.basename(filePath) !== "index.mdx");

  const sections = await Promise.all(
    filteredSectionFiles.map(async (filePath) => {
      const { body, frontmatter } = await readValidatedMdx(filePath, courseSectionSchema);

      return {
        ...frontmatter,
        body,
        courseSlug,
        chapterSlug,
      };
    }),
  );

  return sortByOrder(sections);
}

async function loadChapter(courseSlug: string, chapterSlug: string): Promise<CourseChapter> {
  const chapterIndexPath = contentPath("courses", courseSlug, chapterSlug, "index.mdx");
  const { body, frontmatter } = await readValidatedMdx(chapterIndexPath, courseChapterSchema);
  const sections = await loadSections(courseSlug, chapterSlug);

  return {
    ...frontmatter,
    body,
    courseSlug,
    sections,
  };
}

async function loadCourse(courseSlug: string): Promise<Course> {
  const courseIndexPath = contentPath("courses", courseSlug, "index.mdx");
  const { body, frontmatter } = await readValidatedMdx(courseIndexPath, courseSchema);
  const entries = await readdir(contentPath("courses", courseSlug), { withFileTypes: true });
  const chapterSlugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const chapters = await Promise.all(chapterSlugs.map((chapterSlug) => loadChapter(courseSlug, chapterSlug)));

  return {
    ...frontmatter,
    body,
    chapters: sortByOrder(chapters),
  };
}

export async function getAllCourses() {
  const entries = await readdir(contentPath("courses"), { withFileTypes: true });
  const courseSlugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const courses = await Promise.all(courseSlugs.map(loadCourse));
  return sortByOrder(courses);
}

export async function getCourseBySlug(courseSlug: string) {
  try {
    return await loadCourse(courseSlug);
  } catch {
    return null;
  }
}

export async function getCourseSectionBySlug(
  courseSlug: string,
  chapterSlug: string,
  sectionSlug: string,
) {
  const course = await getCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  const chapter = course.chapters.find((entry) => entry.slug === chapterSlug);

  if (!chapter) {
    return null;
  }

  return chapter.sections.find((entry) => entry.slug === sectionSlug) ?? null;
}
