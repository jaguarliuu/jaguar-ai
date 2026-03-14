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
  return [...source.matchAll(headingPattern)].map((match) => {
    const depth = match[1] === "##" ? 2 : 3;
    const title = match[2].trim();

    return {
      depth,
      slug: slugifyHeading(title),
      title,
    };
  });
}
