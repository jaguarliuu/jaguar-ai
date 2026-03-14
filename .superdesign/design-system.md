# JaguarAI Design System

## Product Context

JaguarAI is a Chinese-language personal AI brand site. It is content-first and organized around three equal pillars:

- `Posts`
- `Daily`
- `Courses`

Secondary areas:

- `Lab`
- `Projects`
- `About`

The site is not a SaaS landing page. It should feel like a technical editorial publication with strong structure, high readability, and restrained visual language.

## Brand Direction

- Brand name: `JaguarAI`
- Tone: calm, rigorous, technical, editorial
- Primary impression: a serious AI content brand maintained by one person with long-term output
- Visual goal: minimalist black-and-white editorial tech

## Core Visual Rules

- Use a predominantly black, white, and gray palette
- Do not use large color blocks
- Do not use gradients as major page backgrounds
- Do not use decorative illustrations
- Do not use playful startup visuals
- Do not use glossy glassmorphism
- Use typography, spacing, borders, and layout rhythm as the primary design tools

## Color System

Primary palette:

- `--bg`: `#f7f7f5`
- `--surface`: `#ffffff`
- `--text`: `#111111`
- `--muted`: `#5f5f5a`
- `--line`: `#d8d8d2`
- `--line-strong`: `#b8b8b0`
- `--soft`: `#efefe9`

Allowed usage:

- Backgrounds should remain near-white
- Surfaces may use subtle paper-tone variation
- Borders use hairline gray
- Text remains dark and high-contrast
- Accent color should be avoided in `v1`

## Typography

Typography must create the site's identity.

### Display / Titles

- Use a serif font for major titles and key editorial headings
- Desired feel: modern editorial, intelligent, calm, not romantic
- Usage:
  - homepage hero title
  - page titles
  - article titles
  - course titles
  - section-leading editorial headlines

### Body / UI

- Use a clean sans-serif for body text, navigation, summaries, labels, buttons, metadata blocks, and sidebars
- Desired feel: neutral, precise, readable for long Chinese text

### Technical Metadata

- Use a monospace font for:
  - dates
  - issue numbers
  - tags
  - reading time
  - chapter and section numbering
  - subtle system labels

## Layout Principles

- Mobile-first responsive design
- Medium information density
- Content pages must prioritize reading comfort
- Desktop may increase density through columns and side navigation
- Mobile must preserve clear content order and hierarchy

### Grid

- Use a restrained editorial grid
- Prefer 1-column and 2-column structures on content pages
- Use 12-column layouts only where they clearly improve structure
- Avoid bento overload

### Spacing

- Spacious but not sparse
- Major sections separated by whitespace and thin dividers
- Avoid oversized empty hero zones

### Borders

- Prefer 1px hairlines and subtle separators
- Borders should feel editorial, not brutalist-heavy

## Component Language

### Navigation

- Minimal top navigation
- Thin separators
- No heavy pill menus
- Compact and readable on mobile

### Cards

- Use cards sparingly
- Prefer flat surfaces with fine borders
- Minimal shadows or no shadows

### Lists

- Lists are the dominant content pattern
- Posts and Daily should feel like editorial indexes rather than marketing grids
- Dense enough to browse, calm enough to read

### Hero

- Hero should be restrained
- No huge illustration
- No giant colored blocks
- Focus on brand positioning, headline, and three primary entrances

## Page-Specific Guidance

### Home

- Editorial index feel
- Hero followed by structured content sections
- Feature the three equal pillars: `Posts`, `Daily`, `Courses`
- `Lab` and `Projects` appear later as secondary proof of activity

### Posts

- Structured article directory
- Vertical list layout with title, summary, date, tags

### Daily

- Similar skeleton to Posts, but more chronological and issue-based
- Stronger date and issue metadata

### Courses

- More structural than Posts
- Clear hierarchy: course -> chapter -> section
- Desktop should support side navigation
- Mobile should use collapsible navigation

### Lab

- Reserved showcase page for future tools
- Should communicate active exploration without pretending tools already exist

### Projects

- Stable output pages for open-source and product work
- More factual and status-oriented than Lab

### About

- Minimal and credible
- Brand and work overview, not a resume-heavy personal page

## Reading Experience

- Long-form reading is a core product requirement
- Keep content width controlled
- Strong heading hierarchy
- Comfortable line height
- Clear code block styling
- Right-side table of contents on desktop where useful
- Mobile reading must remain clean and uninterrupted

## Motion

- Motion should be subtle and sparse
- Use simple fades, slight upward reveals, and state transitions
- Avoid dramatic parallax, floating shapes, and high-energy animation

## Visual Anti-Patterns

Do not introduce:

- purple AI branding
- neon accents
- oversized hero gradients
- oversized rounded cards everywhere
- dashboard-like chrome
- loud startup CTA blocks
- ornamental illustrations
- decorative 3D objects

## Source Style Reference

Base inspiration: `high-contrast-landing-page`

Adaptations required for JaguarAI:

- reduce brutalist aggression
- remove echo-stack typography
- remove luxury-fashion cues
- remove large showcase image structures
- shift from landing page composition to editorial content architecture
- keep monochrome discipline
- keep clean structural typography
- replace grotesque-heavy tone with serif-display plus sans-body pairing

## Design Prompt Guardrails

Every design exploration for JaguarAI must preserve:

- black/white/gray-only palette
- serif titles
- sans-serif body text
- monospace metadata
- minimal surfaces
- thin border structure
- mobile-first responsive behavior
- medium density
- content-first hierarchy
