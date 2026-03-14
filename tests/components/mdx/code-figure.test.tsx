import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeFigure } from "@/components/mdx/code-figure";

describe("CodeFigure", () => {
  it("copies the full code block content", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    render(
      <CodeFigure data-rehype-pretty-code-figure="">
        <pre data-language="ts">
          <code>{`const value = 1;\nconsole.log(value);`}</code>
        </pre>
      </CodeFigure>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));

    expect(writeText).toHaveBeenCalledWith("const value = 1;\nconsole.log(value);");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
