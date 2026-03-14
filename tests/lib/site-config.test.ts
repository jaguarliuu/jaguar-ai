import { createNextConfig, resolveSiteConfig, toAbsoluteUrl } from "@/lib/site-config";

describe("site config", () => {
  it("derives the GitHub Pages base path and site url for a project repository", () => {
    const config = resolveSiteConfig({
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "jaguarliuu/jaguar-ai",
    });

    expect(config.basePath).toBe("/jaguar-ai");
    expect(config.siteUrl).toBe("https://jaguarliuu.github.io/jaguar-ai");
  });

  it("does not add a base path for a user GitHub Pages repository", () => {
    const config = resolveSiteConfig({
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "jaguarliuu/jaguarliuu.github.io",
    });

    expect(config.basePath).toBe("");
    expect(config.siteUrl).toBe("https://jaguarliuu.github.io");
  });

  it("builds a static-export Next config and prefixes assets for project pages", () => {
    const nextConfig = createNextConfig({
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "jaguarliuu/jaguar-ai",
    });

    expect(nextConfig.output).toBe("export");
    expect(nextConfig.trailingSlash).toBe(true);
    expect(nextConfig.basePath).toBe("/jaguar-ai");
    expect(nextConfig.assetPrefix).toBe("/jaguar-ai/");
    expect(nextConfig.images?.unoptimized).toBe(true);
  });

  it("keeps the repository prefix when building absolute urls", () => {
    expect(toAbsoluteUrl("https://jaguarliuu.github.io/jaguar-ai", "/daily")).toBe(
      "https://jaguarliuu.github.io/jaguar-ai/daily",
    );
  });
});
