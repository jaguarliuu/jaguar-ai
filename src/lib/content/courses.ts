import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  courseChapterSchema,
  courseSchema,
  courseSectionSchema,
  type Course,
  type CourseChapter,
  type CourseLessonLink,
  type CourseReference,
  type CourseSection,
} from "./types";
import { contentPath, listContentFiles, readValidatedMdx, sortByOrder } from "./shared";

function toLessonLink(section: CourseSection): CourseLessonLink {
  return {
    courseSlug: section.courseSlug,
    chapterSlug: section.chapterSlug,
    slug: section.slug,
    title: section.title,
  };
}

function attachLessonNeighbors(chapters: CourseChapter[]) {
  const orderedSections = chapters.flatMap((chapter) => chapter.sections);

  orderedSections.forEach((section, index) => {
    section.prev = index > 0 ? toLessonLink(orderedSections[index - 1]) : null;
    section.next =
      index < orderedSections.length - 1 ? toLessonLink(orderedSections[index + 1]) : null;
  });

  return chapters;
}

async function loadSections(
  course: CourseReference,
  chapter: { slug: string; title: string },
): Promise<CourseSection[]> {
  const { slug: courseSlug } = course;
  const { slug: chapterSlug } = chapter;
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
        course,
        chapter,
        prev: null,
        next: null,
      };
    }),
  );

  return sortByOrder(sections);
}

async function loadChapter(course: CourseReference, chapterSlug: string): Promise<CourseChapter> {
  const { slug: courseSlug } = course;
  const chapterIndexPath = contentPath("courses", courseSlug, chapterSlug, "index.mdx");
  const { body, frontmatter } = await readValidatedMdx(chapterIndexPath, courseChapterSchema);
  const sections = await loadSections(course, {
    slug: frontmatter.slug,
    title: frontmatter.title,
  });

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
  const courseRef = {
    slug: frontmatter.slug,
    title: frontmatter.title,
  };
  const chapters = await Promise.all(chapterSlugs.map((chapterSlug) => loadChapter(courseRef, chapterSlug)));

  return {
    ...frontmatter,
    body,
    chapters: attachLessonNeighbors(sortByOrder(chapters)),
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

export async function getCourseChapterBySlug(courseSlug: string, chapterSlug: string) {
  const course = await getCourseBySlug(courseSlug);

  if (!course) {
    return null;
  }

  return course.chapters.find((entry) => entry.slug === chapterSlug) ?? null;
}
