# JaguarAI Site Design

**Brand:** JaguarAI

**Positioning:** A personal AI brand site centered on content, with courses, daily reports, projects, and a reserved lab area for future tools.

## Confirmed Decisions

- The site is a new build from scratch.
- Primary focus is personal brand plus content.
- Main content pillars are `Posts`, `Daily`, and `Courses`, with equal weight.
- `Lab` is reserved in `v1` as a showcase/status area, not a live tools platform yet.
- `Projects` is used for open-source projects and stable product pages.
- The existing AI daily report agent stays external to the website and pushes content by Git.
- Content is maintained by the owner through Git only.
- No CMS is required in `v1`.
- No database is required in `v1`.
- The site must be responsive, mobile-first.
- Only article/course/report body content is in Chinese.
- Brand name, navigation, routing, folder names, and slugs stay in English.

## Product Shape

JaguarAI is one site with three layers:

1. Content layer
   Posts, AI daily reports, and public courses.
2. Exploration layer
   Lab pages that present upcoming tools and research directions.
3. Product layer
   Project pages for open-source work and maintained products.

This avoids building three separate systems. The site acts as one unified personal AI portal.

## Information Architecture

Top-level navigation:

- `Home`
- `Posts`
- `Daily`
- `Courses`
- `Lab`
- `Projects`
- `About`

Route structure:

- `/`
- `/posts`
- `/posts/[slug]`
- `/daily`
- `/daily/[slug]`
- `/courses`
- `/courses/[courseSlug]`
- `/courses/[courseSlug]/[chapterSlug]`
- `/courses/[courseSlug]/[chapterSlug]/[sectionSlug]`
- `/lab`
- `/projects`
- `/projects/[slug]`
- `/about`

## Homepage Narrative

The homepage should lead with brand positioning, not resume details.

Hero priorities:

- Clear JaguarAI title
- One-line positioning statement
- Three equal primary entrances: `Posts`, `Daily`, `Courses`
- Secondary trust signals such as ongoing公众号/B站/开源/日报 agent maintenance

Recommended section order:

1. Hero
2. Featured posts
3. Latest daily reports
4. Courses overview
5. Lab preview
6. Projects showcase

## Content System

Use Git as the only source of truth in `v1`.

Suggested content directories:

- `content/posts/`
- `content/daily/`
- `content/courses/`
- `content/projects/`
- `content/lab/`

All content uses `MDX` with frontmatter.

Core frontmatter fields:

- `title`
- `summary`
- `date`
- `slug`
- `tags`
- `cover`
- `status`

Extra fields by type:

- `daily`: `sources`, `topic`, `issue`
- `project`: `repo`, `demo`, `stage`
- `course`: `series`, `order`, `duration`

## Courses Design

Courses are a structured public knowledge system, not single landing pages.

Hierarchy:

- Course
- Chapter
- Section

Filesystem model:

- `content/courses/<course>/index.mdx`
- `content/courses/<course>/<chapter>/index.mdx`
- `content/courses/<course>/<chapter>/<section>.mdx`

Page roles:

- `/courses`: all courses overview
- `/courses/[courseSlug]`: course landing page with outline and updates
- `/courses/[courseSlug]/[chapterSlug]`: chapter guide page
- `/courses/[courseSlug]/[chapterSlug]/[sectionSlug]`: full public lesson content page

Required reading features:

- Course tree navigation
- Previous/next lesson links
- Current location highlight
- Readable long-form typography
- Mobile-friendly navigation for nested structure

## Daily Agent Integration

The daily report agent remains an external scheduled system.

Its only responsibility for the website:

- generate a valid daily report file
- commit it into `content/daily/`

The website only reads and renders the repository content. This keeps the site decoupled from the agent runtime.

## Lab and Projects

`Lab` and `Projects` must stay separate.

`Lab`:

- future-facing
- experimental
- status-based
- used to show directions such as video summarization, trend tracking, public account learning, and agent workflows

`Projects`:

- stable
- output-oriented
- used for open-source projects and maintained products

`v1` Lab should be a reserved showcase page, not an empty placeholder.

## Responsive Rules

Responsive design is mandatory from the start.

Principles:

- mobile-first layout decisions
- one content system, different density by screen size
- no hover-dependent primary interactions
- reading comfort first on mobile
- course pages optimized for long reading sessions

Desktop can add density and side navigation. Mobile should prioritize sequence and clarity.

## Recommended Technical Direction

Recommended `v1` stack:

- `Next.js` with App Router
- local `MDX` content
- `Tailwind CSS`
- Git-based deployment

Deployment target:

- Vercel or equivalent Git-triggered hosting

## Phase Plan

### v1

- Brand homepage
- Posts system
- Daily report system
- Multi-course structure
- Projects pages
- Lab reserved page
- Responsive design
- Git-driven content flow

### v1.5

- Tag pages
- Search
- Better course navigation
- Table of contents and anchor improvements
- Reading UX refinements

### v2

- Start shipping actual Lab tools
- Add tool-specific execution flows only when needed

## Naming Convention

- Brand display name: `JaguarAI`
- Navigation: English
- URL paths: English
- File names: English
- Slugs: English
- Content body: Chinese

This keeps authoring and routing stable while preserving a fully Chinese reading experience.

## Visual System

Validated visual direction:

- minimalist editorial-tech
- black, white, and gray as the core palette
- no large color blocks
- no gradient-led sections
- no startup-style marketing visuals
- no decorative illustrations
- medium information density
- mobile-first responsive behavior

Typography roles:

- serif for major titles and editorial headings
- sans-serif for body content and interface text
- monospace for metadata such as dates, tags, issue numbers, and lesson position

Layout rules:

- structure is created by spacing, thin dividers, and typography rhythm
- cards are used sparingly
- content lists should feel like indexes, not product galleries
- reading pages prioritize calm, long-form readability

## Homepage Design Notes

The homepage direction has been validated.

Current approved traits:

- brand-first hero for `JaguarAI`
- hero content converted to Chinese
- three equal primary entrances: `Posts`, `Daily`, `Courses`
- editorial section rhythm instead of marketing blocks
- restrained monochrome visual language

## Course Page Design Notes

The course system has four designed page types:

- `Courses Overview`
- `Course Landing`
- `Chapter Guide`
- `Section Reading`

Refinements already applied:

- removed newsletter and lead-capture sections from course pages
- removed most sales-like or premium-membership language
- reduced decorative thumbnail weight on the courses index
- aligned section reading page to a stronger monochrome reading layout
- preserved chapter tree, course hierarchy, and previous/next lesson navigation

Behavioral goals:

- `Courses Overview` should behave like a course index
- `Course Landing` should behave like a public knowledge-course entry page
- `Chapter Guide` should behave like a directory for one chapter
- `Section Reading` should behave like a premium long-form lesson page

## Daily, Projects, About Design Notes

Additional page groups now designed:

- `Daily Overview`
- `Daily Issue`
- `Projects Overview`
- `Project Detail`
- `About`

Refinements already applied:

- removed newsletter and subscription-led sections from the primary page bodies
- reduced media-portal feeling on `Daily`
- preserved issue-archive structure and issue-detail briefing structure
- removed `Lab` positioning from `Projects Overview`
- removed collaboration or recruitment-style tone from project detail
- reduced manifesto tone, inflated metrics, and dramatic brand rhetoric on `About`

Behavioral goals:

- `Daily Overview` should behave like a calm issue archive
- `Daily Issue` should behave like a structured technical briefing
- `Projects Overview` should behave like a factual project index
- `Project Detail` should behave like a maintained project dossier
- `About` should behave like a brand statement plus working profile

## Design Artifacts

Superdesign project:

- `JaguarAI`

Current preview drafts:

- Home: `https://p.superdesign.dev/draft/80516757-abf7-43ca-8b44-ca03073b1661`
- Courses Overview: `https://p.superdesign.dev/draft/ee2f5a26-c66a-486e-a322-9611bc75c9d0`
- Course Landing: `https://p.superdesign.dev/draft/3aeaa32b-067c-4c22-9ed0-f16ebd09b68b`
- Chapter Guide: `https://p.superdesign.dev/draft/1fbafa09-d8ba-4f5a-9f8e-7dd92ef1a751`
- Section Reading: `https://p.superdesign.dev/draft/63abf60f-c307-4458-88ef-8fbcf230e065`
- Daily Overview: `https://p.superdesign.dev/draft/551ebce5-e4c5-49ef-8f3a-0a6795c917ac`
- Daily Issue: `https://p.superdesign.dev/draft/93d87989-d2f2-4ace-b318-fc22a25ac392`
- Projects Overview: `https://p.superdesign.dev/draft/b6f9e6cb-19ea-4bcb-b8db-de0290c4525c`
- Project Detail: `https://p.superdesign.dev/draft/22249519-7168-4ebb-b56f-f748f2a99ed8`
- About: `https://p.superdesign.dev/draft/c13e2b6f-3edc-455a-945d-7d8527e3db84`

These drafts are the visual baseline for implementation unless replaced by later approved iterations.

## Implementation Complete

As of 2026-03-14, the `v1` site foundations are implemented in the repository on branch `codex/jaguarai-v1`.

Implemented route structure:

- `/`
- `/posts`
- `/posts/[slug]`
- `/daily`
- `/daily/[slug]`
- `/courses`
- `/courses/[courseSlug]`
- `/courses/[courseSlug]/[chapterSlug]`
- `/courses/[courseSlug]/[chapterSlug]/[sectionSlug]`
- `/projects`
- `/projects/[slug]`
- `/about`
- `/lab`
- `/sitemap.xml`
- `/robots.txt`

Implementation notes:

- The homepage follows the approved monochrome editorial-tech direction with a Chinese hero and equal-weight entrances for `Posts`, `Daily`, and `Courses`.
- `Daily` content is loaded directly from `content/daily/` and is ready for the external scheduled agent to publish by Git commits.
- `Courses` ship with nested static routes, chapter/lesson navigation, previous-next paging, desktop sidebar navigation, and desktop table of contents.
- `Projects`, `About`, and the reserved `Lab` page are all statically generated from local MDX content.
- `sitemap.xml`, `robots.txt`, and a custom `not-found` page are included in the `v1` foundation.
