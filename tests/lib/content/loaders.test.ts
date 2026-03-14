import { getCourseBySlug } from "@/lib/content/courses";
import { getAllDailyIssues } from "@/lib/content/daily";

describe("content loaders", () => {
  it("loads daily issues in descending date order", async () => {
    const issues = await getAllDailyIssues();

    expect(issues.slice(0, 3).map((issue) => issue.slug)).toEqual([
      "2026-03-14",
      "2026-03-13",
      "2026-03-12",
    ]);
    expect(issues[0]?.title).toBe("AI 技术日报 — 2026.03.14");
    expect(issues[0]?.topic).toBe("长上下文、Agent 工具与国内生态");
  });

  it("builds the nested course tree from markdown chapter files", async () => {
    const course = await getCourseBySlug("miniclaw");

    expect(course?.title).toBe("MiniClaw：从零手写 Agent 基础设施");
    expect(course?.chapters.map((chapter) => chapter.slug)).toEqual([
      "chapter-03",
      "chapter-04",
      "chapter-05",
    ]);
    expect(course?.chapters[1].title).toBe("第4章：从零手写 LLM 客户端");
    expect(course?.chapters[0].sections[0].slug).toBe("dev-env");
    expect(course?.chapters[0].sections[0].title).toBe("第3.1节：开发环境准备");
    expect(course?.chapters[2].sections[0].slug).toBe("why-websocket");
  });
});
