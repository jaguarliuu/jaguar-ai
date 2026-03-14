# JaguarAI V1 Website Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first production-ready JaguarAI website with Git-managed MDX content, responsive editorial UI, and statically generated pages for Home, Posts, Daily, Courses, Projects, About, and a reserved Lab page.

**Architecture:** Build the site in the repo root as a Next.js App Router app under `src/`, while keeping the already-created `docs/` and `.superdesign/` directories in place. Store all editorial content in `content/`, validate frontmatter with `zod`, load it from the filesystem with shared collection utilities, and render MDX through a single server-side MDX pipeline. Reuse one monochrome editorial design system across all archive and detail pages, with courses adding a hierarchical navigation layer on top of the shared content shell.

**Tech Stack:** Next.js 16.1.6, React 19.2.3, TypeScript 5, Tailwind CSS 4, `next-mdx-remote`, `gray-matter`, `fast-glob`, `zod`, `reading-time`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`, Vitest, Testing Library.

---

### Task 1: Bootstrap The Repo Root As A Next.js App

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/icon.svg`
- Test: `tests/app/root-layout.test.tsx`

**Step 1: Write the failing test**

```tsx
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app/root-layout.test.tsx`

Expected: FAIL with `Cannot find module '@/app/layout'` or equivalent missing-file error.

**Step 3: Write minimal implementation**

Create the root app files manually instead of running `create-next-app` in `.`. The repo root is already non-empty because it contains `docs/` and `.superdesign/`.

`package.json`

```json
{
  "name": "jaguar-ai",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fast-glob": "^3.3.3",
    "gray-matter": "^4.0.3",
    "next": "16.1.6",
    "next-mdx-remote": "^5.0.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "reading-time": "^1.5.0",
    "rehype-autolink-headings": "^7.1.0",
    "rehype-slug": "^6.0.0",
    "remark-gfm": "^4.0.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.13",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^20.17.24",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.22.0",
    "eslint-config-next": "16.1.6",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.1.13",
    "typescript": "^5.8.2",
    "vitest": "^3.0.8"
  }
}
```

`src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
});

const serif = Noto_Serif_SC({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "JaguarAI",
    template: "%s | JaguarAI",
  },
  description: "JaguarAI content hub for posts, daily AI briefings, courses, and projects.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} jaguarai-app`}>
        {children}
      </body>
    </html>
  );
}
```

`src/app/page.tsx`

```tsx
export default function HomePage() {
  return <main>JaguarAI</main>;
}
```

`src/app/globals.css`

```css
@import "tailwindcss";

:root {
  --bg: #f7f7f5;
  --surface: #ffffff;
  --text: #111111;
  --muted: #5f5f5a;
  --line: #d8d8d2;
  --line-strong: #b8b8b0;
  --soft: #efefe9;
}

@theme inline {
  --color-background: var(--bg);
  --color-surface: var(--surface);
  --color-foreground: var(--text);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-soft: var(--soft);
  --font-sans: var(--font-sans);
  --font-serif: var(--font-serif);
  --font-mono: var(--font-mono);
}

html {
  background: var(--bg);
  color: var(--text);
}

body {
  background: var(--bg);
  color: var(--text);
}

.jaguarai-app {
  min-height: 100vh;
  font-family: var(--font-sans);
}
```

**Step 4: Run test to verify it passes**

Run:
- `pnpm install`
- `pnpm exec vitest run tests/app/root-layout.test.tsx`
- `pnpm lint`

Expected:
- `pnpm install` completes successfully
- the Vitest test passes
- lint exits `0`

**Step 5: Commit**

```bash
git init
git add .gitignore package.json pnpm-workspace.yaml next-env.d.ts next.config.ts postcss.config.mjs eslint.config.mjs tsconfig.json vitest.config.ts vitest.setup.ts src/app/layout.tsx src/app/page.tsx src/app/globals.css src/app/icon.svg tests/app/root-layout.test.tsx
git commit -m "chore: bootstrap jaguarai next app"
```

### Task 2: Implement The Shared Site Shell And Global Editorial Tokens

**Files:**
- Create: `src/components/site/container.tsx`
- Create: `src/components/site/header.tsx`
- Create: `src/components/site/footer.tsx`
- Create: `src/components/site/nav-links.ts`
- Create: `src/components/site/page-frame.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/components/site/header.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site/header";

it("renders the primary navigation", () => {
  render(<SiteHeader />);

  expect(screen.getByRole("link", { name: "Posts" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Daily" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Courses" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/components/site/header.test.tsx`

Expected: FAIL with missing component import.

**Step 3: Write minimal implementation**

`src/components/site/nav-links.ts`

```ts
export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/posts", label: "Posts" },
  { href: "/daily", label: "Daily" },
  { href: "/courses", label: "Courses" },
  { href: "/lab", label: "Lab" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
] as const;
```

`src/components/site/header.tsx`

```tsx
import Link from "next/link";
import { navLinks } from "./nav-links";
import { Container } from "./container";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/95 backdrop-blur-sm">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          JaguarAI
        </Link>
        <nav className="hidden gap-6 font-mono text-xs uppercase tracking-[0.2em] text-muted md:flex">
          {navLinks.slice(1).map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
```

Update the layout so every page uses `<SiteHeader />`, `<main />`, and `<SiteFooter />`, and mirror the approved black/white token set from `.superdesign/design-system.md`.

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/components/site/header.test.tsx`
- `pnpm lint`

Expected: both pass.

**Step 5: Commit**

```bash
git add src/components/site/container.tsx src/components/site/header.tsx src/components/site/footer.tsx src/components/site/nav-links.ts src/components/site/page-frame.tsx src/app/layout.tsx src/app/globals.css tests/components/site/header.test.tsx
git commit -m "feat: add global site shell"
```

### Task 3: Create Content Schemas, Seed Content, And Filesystem Loaders

**Files:**
- Create: `content/README.md`
- Create: `content/posts/building-agent-workflows.mdx`
- Create: `content/daily/2026-03-14.mdx`
- Create: `content/courses/prompt-engineering/index.mdx`
- Create: `content/courses/prompt-engineering/foundations/index.mdx`
- Create: `content/courses/prompt-engineering/foundations/what-is-prompt-engineering.mdx`
- Create: `content/projects/jaguar-prompt-engine/index.mdx`
- Create: `content/site/about.mdx`
- Create: `content/site/lab.mdx`
- Create: `src/lib/content/types.ts`
- Create: `src/lib/content/shared.ts`
- Create: `src/lib/content/posts.ts`
- Create: `src/lib/content/daily.ts`
- Create: `src/lib/content/courses.ts`
- Create: `src/lib/content/projects.ts`
- Create: `src/lib/content/site-pages.ts`
- Create: `src/lib/content/index.ts`
- Test: `tests/lib/content/loaders.test.ts`

**Step 1: Write the failing test**

```ts
import { getAllDailyIssues } from "@/lib/content/daily";
import { getCourseBySlug } from "@/lib/content/courses";

it("loads daily issues in descending date order", async () => {
  const issues = await getAllDailyIssues();
  expect(issues[0].slug).toBe("2026-03-14");
});

it("builds the nested course tree from directories", async () => {
  const course = await getCourseBySlug("prompt-engineering");
  expect(course?.chapters[0].slug).toBe("foundations");
  expect(course?.chapters[0].sections[0].slug).toBe("what-is-prompt-engineering");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/lib/content/loaders.test.ts`

Expected: FAIL with missing loader files.

**Step 3: Write minimal implementation**

Use `zod` for all frontmatter validation and `fast-glob` + `gray-matter` for filesystem reads.

`src/lib/content/types.ts`

```ts
import { z } from "zod";

export const baseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  slug: z.string(),
  date: z.string(),
  tags: z.array(z.string()).default([]),
  status: z.string().optional(),
  cover: z.string().optional(),
});

export const dailySchema = baseSchema.extend({
  issue: z.number(),
  topic: z.string().optional(),
  sources: z.array(z.string()).default([]),
});

export const courseSchema = baseSchema.extend({
  series: z.string(),
  order: z.number(),
  duration: z.string().optional(),
});
```

`src/lib/content/shared.ts`

```ts
import fg from "fast-glob";
import matter from "gray-matter";
import { readFile } from "node:fs/promises";

export async function readContentFile(path: string) {
  const raw = await readFile(path, "utf8");
  const parsed = matter(raw);
  return {
    body: parsed.content,
    data: parsed.data,
  };
}

export async function listMdxFiles(pattern: string) {
  return fg(pattern, {
    cwd: process.cwd(),
    absolute: true,
    onlyFiles: true,
  });
}
```

Make `content/README.md` document the required frontmatter for `posts`, `daily`, `courses`, `projects`, and `site`.

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/lib/content/loaders.test.ts`
- `pnpm lint`

Expected: loader tests pass and lint exits `0`.

**Step 5: Commit**

```bash
git add content/README.md content/posts/building-agent-workflows.mdx content/daily/2026-03-14.mdx content/courses/prompt-engineering/index.mdx content/courses/prompt-engineering/foundations/index.mdx content/courses/prompt-engineering/foundations/what-is-prompt-engineering.mdx content/projects/jaguar-prompt-engine/index.mdx content/site/about.mdx content/site/lab.mdx src/lib/content/types.ts src/lib/content/shared.ts src/lib/content/posts.ts src/lib/content/daily.ts src/lib/content/courses.ts src/lib/content/projects.ts src/lib/content/site-pages.ts src/lib/content/index.ts tests/lib/content/loaders.test.ts
git commit -m "feat: add typed content loaders"
```

### Task 4: Build The Shared MDX Rendering Pipeline

**Files:**
- Create: `src/lib/mdx.tsx`
- Create: `src/lib/toc.ts`
- Create: `src/components/mdx/mdx-components.tsx`
- Create: `src/components/content/prose.tsx`
- Create: `src/components/content/toc.tsx`
- Test: `tests/lib/mdx/render-mdx.test.tsx`

**Step 1: Write the failing test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { renderMdx } from "@/lib/mdx";

it("renders headings with anchor ids", async () => {
  const result = await renderMdx("# Heading");
  const html = renderToStaticMarkup(result.content);

  expect(html).toContain('id="heading"');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/lib/mdx/render-mdx.test.tsx`

Expected: FAIL with missing `renderMdx`.

**Step 3: Write minimal implementation**

`src/lib/mdx.tsx`

```tsx
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { mdxComponents } from "@/components/mdx/mdx-components";

export async function renderMdx(source: string) {
  return compileMDX({
    source,
    components: mdxComponents,
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
      },
    },
  });
}
```

Add a `buildTableOfContents(source: string)` helper in `src/lib/toc.ts` that extracts `##` and `###` headings for detail pages.

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/lib/mdx/render-mdx.test.tsx`
- `pnpm lint`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/mdx.tsx src/lib/toc.ts src/components/mdx/mdx-components.tsx src/components/content/prose.tsx src/components/content/toc.tsx tests/lib/mdx/render-mdx.test.tsx
git commit -m "feat: add mdx rendering pipeline"
```

### Task 5: Assemble The Homepage And Shared Preview Sections

**Files:**
- Create: `src/components/home/home-hero.tsx`
- Create: `src/components/home/section-heading.tsx`
- Create: `src/components/home/content-preview-grid.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/app/home-page.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

it("shows the three primary content entrances", async () => {
  render(await HomePage());

  expect(screen.getByText("Posts")).toBeInTheDocument();
  expect(screen.getByText("Daily")).toBeInTheDocument();
  expect(screen.getByText("Courses")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app/home-page.test.tsx`

Expected: FAIL because the current placeholder page does not render the approved sections.

**Step 3: Write minimal implementation**

Use the approved homepage structure:

1. Chinese hero copy
2. Three equal entrances for `Posts`, `Daily`, `Courses`
3. Featured posts
4. Latest daily issues
5. Courses overview
6. Projects preview

Keep the layout monochrome and text-led. Do not add newsletter, metrics, or large color blocks.

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/app/home-page.test.tsx`
- `pnpm lint`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/home/home-hero.tsx src/components/home/section-heading.tsx src/components/home/content-preview-grid.tsx src/app/page.tsx tests/app/home-page.test.tsx
git commit -m "feat: implement jaguarai homepage"
```

### Task 6: Implement Posts And Daily Archive/Detail Pages

**Files:**
- Create: `src/components/content/archive-list.tsx`
- Create: `src/components/content/detail-shell.tsx`
- Create: `src/components/content/metadata-strip.tsx`
- Create: `src/app/posts/page.tsx`
- Create: `src/app/posts/[slug]/page.tsx`
- Create: `src/app/daily/page.tsx`
- Create: `src/app/daily/[slug]/page.tsx`
- Test: `tests/app/content-routes.test.tsx`

**Step 1: Write the failing test**

```tsx
import { getAllPostSlugs } from "@/lib/content/posts";
import { getAllDailySlugs } from "@/lib/content/daily";

it("exposes static params for posts and daily issues", async () => {
  expect((await getAllPostSlugs()).length).toBeGreaterThan(0);
  expect((await getAllDailySlugs()).length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app/content-routes.test.tsx`

Expected: FAIL with missing route helpers or missing route modules.

**Step 3: Write minimal implementation**

For both collections:

- archive pages render a calm, chronological index
- detail pages render metadata, TOC, and MDX body
- `generateStaticParams()` reads the collection slugs
- `generateMetadata()` uses the content title and summary
- `notFound()` is called if the slug is invalid

Posts should reuse the same archive grammar as Daily, but without issue numbers.

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/app/content-routes.test.tsx`
- `pnpm build`

Expected: PASS, and the build completes without route-generation errors.

**Step 5: Commit**

```bash
git add src/components/content/archive-list.tsx src/components/content/detail-shell.tsx src/components/content/metadata-strip.tsx src/app/posts/page.tsx src/app/posts/[slug]/page.tsx src/app/daily/page.tsx src/app/daily/[slug]/page.tsx tests/app/content-routes.test.tsx
git commit -m "feat: add posts and daily pages"
```

### Task 7: Implement The Full Course Navigation System

**Files:**
- Create: `src/components/courses/course-header.tsx`
- Create: `src/components/courses/course-outline.tsx`
- Create: `src/components/courses/course-sidebar.tsx`
- Create: `src/components/courses/chapter-list.tsx`
- Create: `src/components/courses/lesson-pager.tsx`
- Create: `src/app/courses/page.tsx`
- Create: `src/app/courses/[courseSlug]/page.tsx`
- Create: `src/app/courses/[courseSlug]/[chapterSlug]/page.tsx`
- Create: `src/app/courses/[courseSlug]/[chapterSlug]/[sectionSlug]/page.tsx`
- Test: `tests/app/course-routes.test.tsx`

**Step 1: Write the failing test**

```ts
import { getCourseBySlug } from "@/lib/content/courses";

it("provides previous and next lesson context", async () => {
  const course = await getCourseBySlug("prompt-engineering");
  const firstSection = course?.chapters[0].sections[0];

  expect(firstSection?.next?.slug).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app/course-routes.test.tsx`

Expected: FAIL because the loader does not yet expose lesson pager context.

**Step 3: Write minimal implementation**

Extend the course loader so each section includes:

- `course`
- `chapter`
- `prev`
- `next`

Then implement the four course routes:

- `/courses`
- `/courses/[courseSlug]`
- `/courses/[courseSlug]/[chapterSlug]`
- `/courses/[courseSlug]/[chapterSlug]/[sectionSlug]`

The section page must render:

- course tree sidebar on desktop
- compact header on mobile
- current lesson highlight
- previous and next lesson links
- TOC next to the article body

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/app/course-routes.test.tsx`
- `pnpm build`

Expected: PASS, and the nested routes build successfully.

**Step 5: Commit**

```bash
git add src/components/courses/course-header.tsx src/components/courses/course-outline.tsx src/components/courses/course-sidebar.tsx src/components/courses/chapter-list.tsx src/components/courses/lesson-pager.tsx src/app/courses/page.tsx src/app/courses/[courseSlug]/page.tsx src/app/courses/[courseSlug]/[chapterSlug]/page.tsx src/app/courses/[courseSlug]/[chapterSlug]/[sectionSlug]/page.tsx tests/app/course-routes.test.tsx src/lib/content/courses.ts
git commit -m "feat: implement course system"
```

### Task 8: Implement Projects, About, And The Reserved Lab Page

**Files:**
- Create: `src/components/projects/project-facts.tsx`
- Create: `src/components/projects/project-list.tsx`
- Create: `src/app/projects/page.tsx`
- Create: `src/app/projects/[slug]/page.tsx`
- Create: `src/app/about/page.tsx`
- Create: `src/app/lab/page.tsx`
- Test: `tests/app/project-and-site-pages.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import AboutPage from "@/app/about/page";

it("renders the Jaguar working profile", async () => {
  render(await AboutPage());
  expect(screen.getByText("关于 Jaguar")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app/project-and-site-pages.test.tsx`

Expected: FAIL with missing route modules.

**Step 3: Write minimal implementation**

Use the approved page behaviors:

- `Projects Overview`: factual index only, no Lab content, no newsletter
- `Project Detail`: project dossier with links, capabilities, notes, and metadata
- `About`: quiet brand statement plus working profile, sourced from `content/site/about.mdx`
- `Lab`: reserved page sourced from `content/site/lab.mdx`, with no live tools

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/app/project-and-site-pages.test.tsx`
- `pnpm lint`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/projects/project-facts.tsx src/components/projects/project-list.tsx src/app/projects/page.tsx src/app/projects/[slug]/page.tsx src/app/about/page.tsx src/app/lab/page.tsx tests/app/project-and-site-pages.test.tsx
git commit -m "feat: add projects and site pages"
```

### Task 9: Add SEO Artifacts, Authoring Safeguards, And Final Verification

**Files:**
- Create: `src/lib/seo.ts`
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`
- Create: `src/app/not-found.tsx`
- Modify: `content/README.md`
- Test: `tests/lib/seo/sitemap.test.ts`

**Step 1: Write the failing test**

```ts
import sitemap from "@/app/sitemap";

it("includes top-level routes and content routes", async () => {
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);

  expect(urls.some((url) => url.endsWith("/daily"))).toBe(true);
  expect(urls.some((url) => url.includes("/courses/prompt-engineering"))).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/lib/seo/sitemap.test.ts`

Expected: FAIL with missing sitemap module.

**Step 3: Write minimal implementation**

Create:

- `src/app/sitemap.ts` using the content loaders
- `src/app/robots.ts` allowing indexing
- `src/app/not-found.tsx` matching the monochrome editorial system
- `src/lib/seo.ts` with helper functions for page titles and descriptions

Update `content/README.md` with:

- required frontmatter by collection
- naming rules for course folders
- example daily issue template for the external daily-report agent

**Step 4: Run test to verify it passes**

Run:
- `pnpm exec vitest run tests/lib/seo/sitemap.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Expected:
- all tests pass
- lint passes
- typecheck passes
- build passes

**Step 5: Commit**

```bash
git add src/lib/seo.ts src/app/sitemap.ts src/app/robots.ts src/app/not-found.tsx content/README.md tests/lib/seo/sitemap.test.ts
git commit -m "feat: finalize jaguarai v1 foundations"
```

### Task 10: Final Review And Deployment Readiness Check

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-14-jaguarai-site-design.md`
- Test: no new test file; run full verification

**Step 1: Write the failing verification list**

Create a local checklist in the task notes:

```md
- home route loads
- posts route loads
- daily route loads
- courses route loads
- projects route loads
- about route loads
- lab route loads
- course lesson page has prev/next links
- sitemap contains dynamic routes
```

**Step 2: Run verification to expose any remaining failures**

Run:
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Expected: if any of these fail, do not proceed; fix the failing route, loader, or component first.

**Step 3: Write minimal documentation updates**

Update `README.md` with:

- local dev commands
- content directory map
- how to add a new course/chapter/section
- how the daily-report agent should commit new issues

Add an implementation-complete note to `docs/plans/2026-03-14-jaguarai-site-design.md` that points to the final route structure if it changed during implementation.

**Step 4: Run the full verification again**

Run:
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Expected: all commands exit `0`.

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-14-jaguarai-site-design.md
git commit -m "docs: prepare jaguarai for deployment"
```
