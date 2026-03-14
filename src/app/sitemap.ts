import type { MetadataRoute } from "next";
import { getAllCourses, getAllDailySlugs, getAllPostSlugs, getAllProjects } from "@/lib/content";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [postSlugs, dailySlugs, courses, projects] = await Promise.all([
    getAllPostSlugs(),
    getAllDailySlugs(),
    getAllCourses(),
    getAllProjects(),
  ]);

  const staticRoutes = ["/", "/posts", "/daily", "/courses", "/projects", "/about", "/lab"];

  return [
    ...staticRoutes.map((path) => ({
      url: absoluteUrl(path),
    })),
    ...postSlugs.map((slug) => ({
      url: absoluteUrl(`/posts/${slug}`),
    })),
    ...dailySlugs.map((slug) => ({
      url: absoluteUrl(`/daily/${slug}`),
    })),
    ...courses.flatMap((course) => [
      {
        url: absoluteUrl(`/courses/${course.slug}`),
      },
      ...course.chapters.flatMap((chapter) => [
        {
          url: absoluteUrl(`/courses/${course.slug}/${chapter.slug}`),
        },
        ...chapter.sections.map((section) => ({
          url: absoluteUrl(`/courses/${course.slug}/${chapter.slug}/${section.slug}`),
        })),
      ]),
    ]),
    ...projects.map((project) => ({
      url: absoluteUrl(`/projects/${project.slug}`),
    })),
  ];
}
