import { render, screen } from "@testing-library/react";
import { CourseOutline } from "@/components/courses/course-outline";

const course = {
  slug: "miniclaw",
  title: "MiniClaw",
  chapters: [
    {
      slug: "chapter-03",
      title: "第3章：环境",
      sections: [
        { slug: "dev-env", title: "开发环境准备" },
        { slug: "docker-compose", title: "Docker Compose" },
      ],
    },
    {
      slug: "chapter-04",
      title: "第4章：LLM",
      sections: [{ slug: "llm-architecture", title: "为什么不用 Spring AI？" }],
    },
  ],
} as const;

describe("CourseOutline", () => {
  it("renders chapters as collapsible sections and opens the current chapter", () => {
    const { container } = render(
      <CourseOutline
        course={course as never}
        currentChapterSlug="chapter-04"
        currentSectionSlug="llm-architecture"
      />,
    );

    const details = container.querySelectorAll("details");

    expect(details).toHaveLength(2);
    expect(details[0]).not.toHaveAttribute("open");
    expect(details[1]).toHaveAttribute("open");
    expect(screen.getByText("为什么不用 Spring AI？")).toBeInTheDocument();
  });
});
