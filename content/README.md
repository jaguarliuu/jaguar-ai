# Content Authoring Guide

All site content lives under `content/` and is committed through Git.

## Collections

- `content/posts/*.mdx`
- `content/daily/*.mdx`
- `content/courses/<course>/index.mdx`
- `content/courses/<course>/<chapter>/index.mdx`
- `content/courses/<course>/<chapter>/<section>.mdx`
- `content/projects/<project>/index.mdx`
- `content/site/about.mdx`
- `content/site/lab.mdx`

## Base frontmatter

```yaml
title: Example Title
summary: Short summary for cards and metadata.
slug: example-slug
date: 2026-03-14
tags:
  - ai
  - engineering
status: published
cover:
```

## Daily frontmatter

```yaml
title: AI Daily Title
summary: Brief issue summary.
slug: 2026-03-14
date: 2026-03-14
tags:
  - agents
issue: 145
topic: agent systems
sources:
  - https://example.com/article
status: published
```

## Course frontmatter

Course landing:

```yaml
title: Prompt Engineering Masterclass
summary: Systematic public course on prompt engineering.
slug: prompt-engineering
date: 2026-03-14
tags:
  - prompts
series: JaguarAI Academy
order: 1
duration: 4 hours
status: active
```

Chapter:

```yaml
title: Foundations
summary: Build the base mental model.
slug: foundations
date: 2026-03-14
tags:
  - prompts
order: 1
duration: 45 min
status: active
```

Section:

```yaml
title: What Is Prompt Engineering
summary: Define the discipline and why it matters.
slug: what-is-prompt-engineering
date: 2026-03-14
tags:
  - prompts
order: 1
status: active
```

## Project frontmatter

```yaml
title: Jaguar Prompt Engine
summary: Prompt orchestration engine for production LLM systems.
slug: jaguar-prompt-engine
date: 2026-03-14
tags:
  - llm
  - tooling
kind: open-source
stage: active
repo: https://github.com/example/jaguar-prompt-engine
demo:
status: active
```

## Site page frontmatter

```yaml
title: About JaguarAI
summary: Brand statement and working profile.
slug: about
```

## Daily agent publishing

The external daily-report agent should write a new `content/daily/YYYY-MM-DD.mdx` file and commit it directly. The website does not need a database or webhook for `v1`.
