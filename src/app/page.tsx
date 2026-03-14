import { ContentPreviewGrid } from "@/components/home/content-preview-grid";
import { HomeHero } from "@/components/home/home-hero";
import { SectionHeading } from "@/components/home/section-heading";
import { Container } from "@/components/site/container";
import { getAllCourses, getAllDailyIssues, getAllPosts, getAllProjects } from "@/lib/content";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function countCourseSections(chapters: Array<{ sections: unknown[] }>) {
  return chapters.reduce((total, chapter) => total + chapter.sections.length, 0);
}

export default async function HomePage() {
  const [posts, issues, courses, projects] = await Promise.all([
    getAllPosts(),
    getAllDailyIssues(),
    getAllCourses(),
    getAllProjects(),
  ]);

  const primaryPillars = [
    {
      href: "/posts",
      label: "Posts",
      summary: "围绕 Agent、AI 工程和内容系统的长文写作，强调结构、方法与长期价值。",
      meta: `${posts.length} items`,
    },
    {
      href: "/daily",
      label: "Daily",
      summary: "由外部日报 Agent 按日推送，沉淀值得追踪的模型、工具和工程信号。",
      meta: issues[0] ? `Issue ${issues[0].issue}` : "Archive",
    },
    {
      href: "/courses",
      label: "Courses",
      summary: "公开、章节化、全文可读的 AI 课程系统，逐步从概念走向真实工作流。",
      meta: `${courses.length} series`,
    },
  ];

  const featuredPosts = posts.slice(0, 3).map((post) => ({
    href: `/posts/${post.slug}`,
    kicker: "Post",
    title: post.title,
    summary: post.summary,
    meta: formatDate(post.date),
    footer: post.tags.join(" / "),
  }));

  const latestIssues = issues.slice(0, 3).map((issue) => ({
    href: `/daily/${issue.slug}`,
    kicker: "Daily",
    title: issue.title,
    summary: issue.summary,
    meta: `Issue ${issue.issue}`,
    footer: formatDate(issue.date),
  }));

  const courseHighlights = courses.slice(0, 3).map((course) => ({
    href: `/courses/${course.slug}`,
    kicker: "Course",
    title: course.title,
    summary: course.summary,
    meta: `${course.chapters.length} chapters`,
    footer: `${countCourseSections(course.chapters)} lessons`,
  }));

  const projectHighlights = projects.slice(0, 3).map((project) => ({
    href: `/projects/${project.slug}`,
    kicker: "Project",
    title: project.title,
    summary: project.summary,
    meta: project.stage,
    footer: project.kind,
  }));

  return (
    <Container>
      <HomeHero pillars={primaryPillars} />

      <section className="py-14 md:py-18">
        <SectionHeading
          eyebrow="Featured Writing"
          title="Posts"
          description="优先呈现结构化长文。首页不做信息流，而是保留清晰、可回看的内容入口。"
          href="/posts"
        />
        <ContentPreviewGrid items={featuredPosts} />
      </section>

      <section className="border-t border-line py-14 md:py-18">
        <SectionHeading
          eyebrow="Daily Briefing"
          title="Daily"
          description="日报保持日历式更新节奏，聚焦值得追踪而不是短暂起伏的 AI 信号。"
          href="/daily"
        />
        <ContentPreviewGrid items={latestIssues} />
      </section>

      <section className="border-t border-line py-14 md:py-18">
        <SectionHeading
          eyebrow="Public Learning"
          title="Courses"
          description="课程部分采用课程、章节、小节三级结构，所有正文暂时全部公开阅读。"
          href="/courses"
        />
        <ContentPreviewGrid items={courseHighlights} />
      </section>

      <section className="border-t border-line py-14 md:py-20">
        <SectionHeading
          eyebrow="Maintained Work"
          title="Projects"
          description="项目页展示已经在维护的产品和开源项目，强调状态、范围和长期迭代。"
          href="/projects"
        />
        <ContentPreviewGrid items={projectHighlights} columns={1} />
      </section>
    </Container>
  );
}
