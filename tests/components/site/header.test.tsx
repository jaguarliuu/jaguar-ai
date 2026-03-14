import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site/header";

describe("SiteHeader", () => {
  it("renders the primary navigation", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Daily" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Courses" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });
});
