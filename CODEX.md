# Repository Workflow

## MiniClaw Course Project

- `miniclaw/` is the working project for the MiniClaw course.
- Treat `miniclaw/` as course source material, not as a git-managed deliverable that needs branch hygiene or commit preparation.
- Do not optimize the workflow around `miniclaw/.git`; focus on code correctness and course alignment.

## Required Authoring Order

- Implement code first.
- Verify the code with focused tests and broader compile or test commands.
- Update course documentation only after the code is verified.
- Course documents must describe the code that actually exists in `miniclaw/backend`.

## Course Maintenance Rules

- When a chapter changes, update the backend implementation before rewriting the chapter markdown.
- Prefer deterministic local tests over manual API-key-based verification.
- Keep examples in chapter docs aligned with real class names, method names, and behavior in the codebase.
- If code and docs diverge, fix the code path first, then rewrite the doc to match verified behavior.
- Assume the learner baseline is Java 8 unless the user says otherwise.
- When a chapter uses Java 9+ language features or newer JDK APIs, explain them explicitly at first use.
- When a chapter introduces Reactor or WebFlux operators, translate them into an imperative Java mental model before diving into the chain-style code.
- If snippets use syntax such as switch expressions, pattern matching for `instanceof`, `Stream.toList()`, text blocks, records, or similar newer features, provide the Java 8 equivalent or a side-by-side explanation.
- When a chapter introduces core reliability concepts such as exponential backoff, jitter, timeout, retry budget, circuit breaking, or fallback, explain the motivation, the formula or rule, a concrete timeline example, and the tradeoff against simpler alternatives.
