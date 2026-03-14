# JaguarAI

JaguarAI is a Git-managed personal AI content site built with Next.js App Router and local MDX content.

## Local development

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

If you want sitemap and robots to use a real production domain, set one of:

- `NEXT_PUBLIC_SITE_URL`
- `SITE_URL`

## Content map

- `content/posts/`: long-form articles
- `content/daily/`: AI daily issues pushed by the external daily-report agent
- `content/courses/`: course -> chapter -> section hierarchy
- `content/projects/`: maintained project pages
- `content/site/about.mdx`: about page body
- `content/site/lab.mdx`: reserved lab page body

Detailed frontmatter rules live in [content/README.md](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/README.md).

## Add a course

1. Create `content/courses/<course-slug>/index.mdx`.
2. Create one folder per chapter: `content/courses/<course-slug>/<chapter-slug>/`.
3. Add each chapter entry file as `index.mdx`.
4. Add lessons as `content/courses/<course-slug>/<chapter-slug>/<section-slug>.mdx`.
5. Keep every folder name, file name, and frontmatter `slug` in sync.

Example:

```text
content/courses/prompt-engineering/
content/courses/prompt-engineering/index.mdx
content/courses/prompt-engineering/foundations/index.mdx
content/courses/prompt-engineering/foundations/what-is-prompt-engineering.mdx
```

## Daily-report agent workflow

The daily-report agent stays outside this site.

Its contract is simple:

1. Generate a valid `content/daily/YYYY-MM-DD.mdx` file.
2. Commit the file into this repository.
3. Push to the Git remote so the hosting platform rebuilds the site.

The website does not need a database, webhook, or admin panel for this flow.
