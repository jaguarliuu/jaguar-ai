import type { HTMLAttributes } from "react";

type ProseProps = HTMLAttributes<HTMLDivElement>;

export function Prose({ className, ...props }: ProseProps) {
  return (
    <div
      className={[
        "jaguar-prose text-[15px] leading-8 text-foreground",
        "[&_h1]:mt-0 [&_h1]:font-serif [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight",
        "[&_h2]:mt-16 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight",
        "[&_h3]:mt-10 [&_h3]:font-serif [&_h3]:text-2xl [&_h3]:font-semibold",
        "[&_p]:my-5 [&_p]:text-[15px] [&_p]:leading-8",
        "[&_ul]:my-5 [&_ul]:pl-5 [&_ul]:list-disc",
        "[&_ol]:my-5 [&_ol]:pl-5 [&_ol]:list-decimal",
        "[&_li]:my-2",
        "[&_blockquote]:my-6 [&_blockquote]:border-l [&_blockquote]:border-line-strong [&_blockquote]:pl-4 [&_blockquote]:text-muted",
        "[&_pre]:my-0 [&_pre]:overflow-x-auto [&_pre]:bg-transparent [&_pre]:p-0",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_hr]:my-10 [&_hr]:border-t [&_hr]:border-line",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
