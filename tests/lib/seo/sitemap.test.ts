import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes top-level routes and content routes", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/daily"))).toBe(true);
    expect(urls.some((url) => url.includes("/courses/prompt-engineering"))).toBe(true);
    expect(urls.some((url) => url.includes("/projects/jaguar-prompt-engine"))).toBe(true);
  });
});
