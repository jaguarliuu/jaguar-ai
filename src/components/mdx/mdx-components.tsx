import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import { CodeFigure } from "./code-figure";
import { MermaidDiagram } from "./mermaid-diagram";
function Heading({
  as: Tag,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  as: "h1" | "h2" | "h3";
}) {
  return <Tag className={className} {...props} />;
}

function Anchor({ className, href, rel, target, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = href?.startsWith("http");

  return (
    <a
      className={["underline underline-offset-4 transition-colors hover:text-muted", className]
        .filter(Boolean)
        .join(" ")}
      href={href}
      rel={isExternal ? rel ?? "noreferrer" : rel}
      target={isExternal ? target ?? "_blank" : target}
      {...props}
    />
  );
}

export const mdxComponents = {
  h1: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <Heading as="h1" className="scroll-mt-28" {...props} />
  ),
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <Heading as="h2" className="scroll-mt-28 border-t border-line pt-8" {...props} />
  ),
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => (
    <Heading as="h3" className="scroll-mt-28" {...props} />
  ),
  figure: (props: HTMLAttributes<HTMLElement>) => <CodeFigure {...props} />,
  MermaidDiagram,
  a: Anchor,
};
