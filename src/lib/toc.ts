export type TocItem = {
  depth: 2 | 3;
  slug: string;
  title: string;
};

const headingPattern = /^(##|###)\s+(.+)$/gm;

export function slugifyHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function buildTableOfContents(source: string): TocItem[] {
  const slugCounts = new Map<string, number>();

  return [...source.matchAll(headingPattern)].map((match) => {
    const depth = match[1] === "##" ? 2 : 3;
    const title = match[2].trim();
    const baseSlug = slugifyHeading(title);
    const duplicateCount = slugCounts.get(baseSlug) ?? 0;
    const slug = duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`;

    slugCounts.set(baseSlug, duplicateCount + 1);

    return {
      depth,
      slug,
      title,
    };
  });
}
