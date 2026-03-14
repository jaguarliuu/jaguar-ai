import { sitePageSchema, type SitePage } from "./types";
import { contentPath, readValidatedMdx } from "./shared";

export async function getSitePageBySlug(slug: "about" | "lab"): Promise<SitePage | null> {
  try {
    const { body, frontmatter } = await readValidatedMdx(contentPath("site", `${slug}.mdx`), sitePageSchema);

    return {
      ...frontmatter,
      body,
    };
  } catch {
    return null;
  }
}
