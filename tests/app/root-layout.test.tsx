import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("renders zh-CN and the JaguarAI body classes", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main>child</main>
      </RootLayout>,
    );

    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain("jaguarai-app");
    expect(html).toContain("Back to top");
  });
});
