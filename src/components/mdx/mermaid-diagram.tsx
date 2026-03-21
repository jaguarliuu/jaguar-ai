"use client";

import { useEffect, useId, useState } from "react";

type MermaidDiagramProps = {
  chart: string;
};

type MermaidState =
  | { status: "pending"; svg: string | null }
  | { status: "rendered"; svg: string }
  | { status: "error"; svg: null };

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const diagramId = useId().replace(/:/g, "");
  const [state, setState] = useState<MermaidState>({
    status: "pending",
    svg: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });

        const { svg } = await mermaid.render(`mermaid-${diagramId}`, chart);

        if (!cancelled) {
          setState({
            status: "rendered",
            svg,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            svg: null,
          });
        }
      }
    }

    setState({
      status: "pending",
      svg: null,
    });
    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId]);

  if (state.status === "error") {
    return (
      <figure className="my-8 overflow-hidden rounded-[24px] border border-amber-200 bg-amber-50">
        <figcaption className="border-b border-amber-200 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-900">
          Mermaid
        </figcaption>
        <div className="px-5 py-4">
          <p className="m-0 text-sm font-medium text-amber-950">
            Mermaid diagram could not be rendered.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-amber-200 bg-white p-4 text-sm leading-7 text-amber-950">
            <code>{chart}</code>
          </pre>
        </div>
      </figure>
    );
  }

  return (
    <figure
      className="my-8 overflow-hidden rounded-[24px] border border-line bg-surface"
      data-mermaid-diagram=""
    >
      <figcaption className="border-b border-line bg-soft px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Mermaid
      </figcaption>
      <div className="px-4 py-4 md:px-6">
        {state.svg ? (
          <div
            className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            data-testid="mermaid-diagram"
            dangerouslySetInnerHTML={{ __html: state.svg }}
          />
        ) : (
          <pre className="m-0 overflow-x-auto rounded-2xl border border-line bg-background p-4 text-sm leading-7 text-muted">
            <code>{chart}</code>
          </pre>
        )}
      </div>
    </figure>
  );
}
