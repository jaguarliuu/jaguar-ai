import { render, screen, waitFor } from "@testing-library/react";
import { MermaidDiagram } from "@/components/mdx/mermaid-diagram";

const renderMock = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

describe("MermaidDiagram", () => {
  beforeEach(() => {
    renderMock.mockReset();
  });

  it("renders svg output for valid mermaid source", async () => {
    renderMock.mockResolvedValue({ svg: "<svg><text>diagram</text></svg>" });

    render(<MermaidDiagram chart={"flowchart TD\nA-->B"} />);

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-diagram")).toContainHTML("<svg><text>diagram</text></svg>");
    });
  });

  it("shows the source when mermaid rendering fails", async () => {
    renderMock.mockRejectedValue(new Error("bad diagram"));

    render(<MermaidDiagram chart={"flowchart TD\nA-->B"} />);

    await waitFor(() => {
      expect(screen.getByText("Mermaid diagram could not be rendered.")).toBeInTheDocument();
    });

    expect(screen.getByText((content) => content.includes("flowchart TD") && content.includes("A-->B"))).toBeInTheDocument();
  });
});
