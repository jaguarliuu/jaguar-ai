import { MDXRemote } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { rehypeMermaidDiagrams } from "./rehype-mermaid-diagrams";

const CODE_SEGMENT_PATTERN = /```[\s\S]*?```|`[^`\n]+`/g;
const prettyCodeOptions = {
  theme: "github-light",
  keepBackground: false,
  bypassInlineCode: true,
};

function escapePlainTextMdx(source: string) {
  return source.replace(/<(?=\d)/g, "&lt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}

function normalizeLiteralMdx(source: string) {
  const segments = source.split(CODE_SEGMENT_PATTERN);
  const codeSegments = source.match(CODE_SEGMENT_PATTERN) ?? [];

  return segments.reduce((result, segment, index) => {
    const nextCodeSegment = codeSegments[index] ?? "";
    return `${result}${escapePlainTextMdx(segment)}${nextCodeSegment}`;
  }, "");
}

export async function renderMdx(source: string) {
  return {
    content: await MDXRemote({
      source: normalizeLiteralMdx(source),
      components: mdxComponents,
      options: {
        parseFrontmatter: false,
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            rehypeSlug,
            [rehypePrettyCode, prettyCodeOptions],
            rehypeMermaidDiagrams,
          ],
        },
      },
    }),
  };
}
