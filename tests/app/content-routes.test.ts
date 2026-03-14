import { generateStaticParams as generateDailyParams } from "@/app/daily/[slug]/page";
import { generateStaticParams as generatePostParams } from "@/app/posts/[slug]/page";

describe("content routes", () => {
  it("exposes static params for posts and daily issues", async () => {
    expect(await generatePostParams()).toContainEqual({ slug: "building-agent-workflows" });
    expect(await generateDailyParams()).toContainEqual({ slug: "2026-03-14" });
  });
});
