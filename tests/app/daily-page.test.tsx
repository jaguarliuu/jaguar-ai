import { render, screen } from "@testing-library/react";
import DailyDetailPage from "@/app/daily/[slug]/page";

describe("DailyDetailPage", () => {
  it("does not render the page table of contents", async () => {
    render(
      await DailyDetailPage({
        params: Promise.resolve({
          slug: "2026-03-14",
        }),
      }),
    );

    expect(screen.queryByText("On this page")).not.toBeInTheDocument();
  });
});
