import { render, screen } from "@testing-library/react";
import AboutPage from "@/app/about/page";
import { generateStaticParams as generateProjectParams } from "@/app/projects/[slug]/page";

describe("project and site pages", () => {
  it("renders the Jaguar working profile", async () => {
    render(await AboutPage());

    expect(screen.getByText("关于 Jaguar")).toBeInTheDocument();
  });

  it("exposes project static params", async () => {
    expect(await generateProjectParams()).toContainEqual({
      slug: "jaguar-prompt-engine",
    });
  });
});
