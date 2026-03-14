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
import { contentPath, listContentFiles, readValidatedMdx, resolveContentFile, sortByOrder } from "./shared";

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

async function loadDirectorySections(
  course: CourseReference,
  chapter: { slug: string; title: string },
): Promise<CourseSection[]> {
  const { slug: courseSlug } = course;
  const { slug: chapterSlug } = chapter;
  const sectionFiles = await listContentFiles(`courses/${courseSlug}/${chapterSlug}/*.{md,mdx}`);
  const filteredSectionFiles = sectionFiles.filter(
    (filePath) => !path.basename(filePath).startsWith("index."),
  );

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

async function loadDirectoryChapter(course: CourseReference, chapterSlug: string): Promise<CourseChapter> {
  const { slug: courseSlug } = course;
  const chapterIndexPath = await resolveContentFile(contentPath("courses", courseSlug, chapterSlug, "index"));
  const { body, frontmatter } = await readValidatedMdx(chapterIndexPath, courseChapterSchema);
  const sections = await loadDirectorySections(course, {
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

function getFlatChapterInfo(filePath: string) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const chapterMatch = fileName.match(/^(\d{2})-00-chapter-index$/);

  if (chapterMatch) {
    return {
      chapterNumber: chapterMatch[1],
      kind: "chapter" as const,
    };
  }

  const sectionMatch = fileName.match(/^(\d{2})-(\d{2})-(.+)$/);

  if (!sectionMatch) {
    return null;
  }

  return {
    chapterNumber: sectionMatch[1],
    kind: "section" as const,
  };
}

async function loadFlatChapters(course: CourseReference): Promise<CourseChapter[]> {
  const chapterFiles = await listContentFiles(`courses/${course.slug}/chapters/*.{md,mdx}`);
  const chapterMap = new Map<
    string,
    {
      chapter: CourseChapter | null;
      sections: CourseSection[];
    }
  >();

  for (const filePath of chapterFiles) {
    const info = getFlatChapterInfo(filePath);

    if (!info) {
      continue;
    }

    const existing = chapterMap.get(info.chapterNumber) ?? {
      chapter: null,
      sections: [],
    };

    if (info.kind === "chapter") {
      const { body, frontmatter } = await readValidatedMdx(filePath, courseChapterSchema);

      existing.chapter = {
        ...frontmatter,
        body,
        courseSlug: course.slug,
        sections: [],
      };
    } else {
      const { body, frontmatter } = await readValidatedMdx(filePath, courseSectionSchema);
      const fallbackChapterRef = {
        slug: `chapter-${info.chapterNumber}`,
        title: `Chapter ${info.chapterNumber}`,
      };
      const chapterRef = existing.chapter
        ? { slug: existing.chapter.slug, title: existing.chapter.title }
        : fallbackChapterRef;

      existing.sections.push({
        ...frontmatter,
        body,
        courseSlug: course.slug,
        chapterSlug: chapterRef.slug,
        course,
        chapter: chapterRef,
        prev: null,
        next: null,
      });
    }

    chapterMap.set(info.chapterNumber, existing);
  }

  return [...chapterMap.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([chapterNumber, value]) => {
      if (!value.chapter) {
        throw new Error(`Missing chapter index for chapter ${chapterNumber}`);
      }

      const chapterRef = {
        slug: value.chapter.slug,
        title: value.chapter.title,
      };

      return {
        ...value.chapter,
        sections: sortByOrder(value.sections).map((section) => ({
          ...section,
          chapterSlug: chapterRef.slug,
          chapter: chapterRef,
        })),
      };
    });
}

async function loadCourse(courseSlug: string): Promise<Course> {
  const courseIndexPath = await resolveContentFile(contentPath("courses", courseSlug, "index"));
  const { body, frontmatter } = await readValidatedMdx(courseIndexPath, courseSchema);
  const entries = await readdir(contentPath("courses", courseSlug), { withFileTypes: true });
  const courseRef = {
    slug: frontmatter.slug,
    title: frontmatter.title,
  };
  const hasFlatChapters = entries.some((entry) => entry.isDirectory() && entry.name === "chapters");
  const chapters = hasFlatChapters
    ? await loadFlatChapters(courseRef)
    : await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .map((chapterSlug) => loadDirectoryChapter(courseRef, chapterSlug)),
      );

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
