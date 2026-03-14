import { execFileSync } from "node:child_process";
import path from "node:path";

describe(".gitignore", () => {
  it("does not ignore committed course content", () => {
    const target = path.join("content", "courses", "miniclaw", "index.md");

    expect(() =>
      execFileSync("git", ["check-ignore", "-q", target], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).toThrow();
  });
});
