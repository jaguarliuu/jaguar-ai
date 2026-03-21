function isElement(node: unknown): node is {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: unknown[];
} {
  return Boolean(node) && typeof node === "object" && (node as { type?: string }).type === "element";
}

function hasMermaidClass(value: unknown) {
  return Array.isArray(value) && value.includes("language-mermaid");
}

function hasMermaidLanguage(value: unknown) {
  return value === "mermaid";
}

function collectText(node: unknown): string {
  if (!node || typeof node !== "object") {
    return "";
  }

  const candidate = node as {
    type?: string;
    value?: string;
    children?: unknown[];
  };

  if (candidate.type === "text") {
    return candidate.value ?? "";
  }

  return (candidate.children ?? []).map(collectText).join("");
}

function findMermaidCode(node: unknown):
  | {
      chart: string;
    }
  | null {
  if (!isElement(node)) {
    return null;
  }

  if (node.tagName === "code" && hasMermaidClass(node.properties?.className)) {
    return {
      chart: collectText(node).trim(),
    };
  }

  if (
    node.tagName === "code" &&
    hasMermaidLanguage(node.properties?.["data-language"])
  ) {
    return {
      chart: collectText(node).trim(),
    };
  }

  for (const child of node.children ?? []) {
    const match = findMermaidCode(child);

    if (match) {
      return match;
    }
  }

  return null;
}

function hasChildren(node: unknown): node is {
  children: unknown[];
} {
  return Boolean(node) && typeof node === "object" && Array.isArray((node as { children?: unknown[] }).children);
}

function transformNode(node: unknown) {
  if (!hasChildren(node)) {
    return;
  }

  node.children = node.children.map((child) => {
    const mermaid = findMermaidCode(child);

    if (mermaid) {
      return {
        type: "element",
        tagName: "MermaidDiagram",
        properties: {
          chart: mermaid.chart,
        },
        children: [],
      };
    }

    transformNode(child);
    return child;
  });
}

export function rehypeMermaidDiagrams() {
  return function transformer(tree: unknown) {
    transformNode(tree);
  };
}
