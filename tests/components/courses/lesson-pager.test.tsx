import { render, screen } from "@testing-library/react";
import { LessonPager } from "@/components/courses/lesson-pager";

describe("LessonPager", () => {
  it("renders pager links as full card layouts", () => {
    render(
      <LessonPager
        prev={{
          courseSlug: "miniclaw",
          chapterSlug: "chapter-03",
          slug: "dev-env",
          title: "第3.1节：开发环境准备",
        }}
        next={{
          courseSlug: "miniclaw",
          chapterSlug: "chapter-03",
          slug: "docker-compose",
          title: "第3.2节：一键启动 - Docker Compose 编排基础设施",
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /第3.1节：开发环境准备/i })).toHaveClass("flex", "h-full");
    expect(
      screen.getByRole("link", { name: /第3.2节：一键启动 - Docker Compose 编排基础设施/i }),
    ).toHaveClass("flex", "h-full");
  });
});
