import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("shows the three primary content entrances", async () => {
    render(await HomePage());

    expect(screen.getByRole("link", { name: /^Posts/ })).toHaveAttribute("href", "/posts");
    expect(screen.getByRole("link", { name: /^Daily/ })).toHaveAttribute("href", "/daily");
    expect(screen.getByRole("link", { name: /^Courses/ })).toHaveAttribute("href", "/courses");
  });
});
