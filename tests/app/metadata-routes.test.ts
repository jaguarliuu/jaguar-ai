import * as robotsModule from "@/app/robots";
import * as sitemapModule from "@/app/sitemap";

describe("metadata routes", () => {
  it("marks robots and sitemap as force-static for export builds", () => {
    expect(robotsModule.dynamic).toBe("force-static");
    expect(sitemapModule.dynamic).toBe("force-static");
  });
});
