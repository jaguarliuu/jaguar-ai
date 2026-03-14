"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

type CodeFigureProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  "data-rehype-pretty-code-figure"?: string;
};

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function CodeFigure({
  children,
  className,
  "data-rehype-pretty-code-figure": prettyCodeFigure,
  ...props
}: CodeFigureProps) {
  const figureRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (prettyCodeFigure === undefined) {
    return (
      <figure className={className} {...props}>
        {children}
      </figure>
    );
  }

  async function handleCopy() {
    const code = figureRef.current?.querySelector("code");
    const text = code?.textContent;

    if (!text) {
      return;
    }

    await copyText(text);
    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  return (
    <figure
      ref={figureRef}
      className={className}
      data-rehype-pretty-code-figure={prettyCodeFigure}
      {...props}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line bg-soft px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Code</span>
        <button
          type="button"
          className="rounded-full border border-line bg-background px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:border-line-strong hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      {children}
    </figure>
  );
}
