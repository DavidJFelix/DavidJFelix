# Blog Migration Plan

## Goal

Migrate djf.io from Starlight to a custom Astro + MDX + PandaCSS setup for greater control over layout, styling, and site structure.

## Rationale

- Starlight is designed for documentation sites with specific conventions
- Custom setup allows more flexibility for a personal blog/portfolio
- PandaCSS is already configured but underutilized with Starlight's built-in styles
- Greater control over page layouts, navigation, and design

## Current State

- **Framework**: Astro 5.0.4 with Starlight 0.37.0
- **Content**: 3 blog posts (.md) + 1 home page (.mdx)
- **Styling**: PandaCSS configured but fighting Starlight defaults
- **Location**: `apps/djf.io/`

### Current Content

| File | Type | Description |
|------|------|-------------|
| `src/content/docs/index.mdx` | Home | About page with bio and career history |
| `src/content/docs/blog/2023-12-30-shipposting.md` | Blog | On shipping products |
| `src/content/docs/blog/2024-4-26-on-positivity.md` | Blog | On being constructively critical |
| `src/content/docs/blog/2025-12-07-on-running.md` | Blog | Marathon training reflections |

### Current Dependencies to Remove

- `@astrojs/starlight` - The documentation framework

### Dependencies to Keep

- `astro` - Core framework
- `@pandacss/dev` - Styling
- `@park-ui/panda-preset` - Component styles
- `@ark-ui/react` - Accessible components
- `react`, `react-dom` - UI components

## Migration Phases

### Phase 1: Project Setup

- [ ] Create new content collection schema for blog posts
- [ ] Create new content collection schema for pages
- [ ] Update `src/content/config.ts` to remove Starlight schemas

**Files to modify:**
- `apps/djf.io/src/content/config.ts`

### Phase 2: Layout System

- [ ] Create base layout component (`src/layouts/BaseLayout.astro`)
- [ ] Create blog post layout (`src/layouts/BlogPost.astro`)
- [ ] Create page layout (`src/layouts/Page.astro`)
- [ ] Implement responsive navigation component
- [ ] Implement footer component

**Files to create:**
- `apps/djf.io/src/layouts/BaseLayout.astro`
- `apps/djf.io/src/layouts/BlogPost.astro`
- `apps/djf.io/src/layouts/Page.astro`
- `apps/djf.io/src/components/Navigation.astro`
- `apps/djf.io/src/components/Footer.astro`

### Phase 3: Styling Foundation

- [ ] Define design tokens in PandaCSS config (colors, typography, spacing)
- [ ] Create global styles
- [ ] Style navigation component
- [ ] Style blog post layout
- [ ] Style code blocks and syntax highlighting

**Files to modify:**
- `apps/djf.io/panda.config.ts`
- `apps/djf.io/src/styles/global.css`

### Phase 4: Content Migration

- [ ] Move blog posts from `src/content/docs/blog/` to `src/content/blog/`
- [ ] Update frontmatter schema for blog posts
- [ ] Convert home page to use new layout
- [ ] Verify all internal links work

**Content changes:**
- Update frontmatter in all blog posts to match new schema
- Remove Starlight-specific frontmatter fields

### Phase 5: Page Routes

- [ ] Create blog index page (`src/pages/blog/index.astro`)
- [ ] Create dynamic blog post route (`src/pages/blog/[...slug].astro`)
- [ ] Create home page (`src/pages/index.astro`)
- [ ] Set up RSS feed (`src/pages/rss.xml.ts`)

**Files to create:**
- `apps/djf.io/src/pages/index.astro`
- `apps/djf.io/src/pages/blog/index.astro`
- `apps/djf.io/src/pages/blog/[...slug].astro`
- `apps/djf.io/src/pages/rss.xml.ts`

### Phase 6: Remove Starlight

- [ ] Remove `@astrojs/starlight` from dependencies
- [ ] Update `astro.config.mjs` to remove Starlight integration
- [ ] Clean up any Starlight-specific files
- [ ] Remove `src/content/docs/` directory after migration

**Files to modify:**
- `apps/djf.io/package.json`
- `apps/djf.io/astro.config.mjs`

### Phase 7: Polish

- [ ] Add SEO meta tags
- [ ] Implement Open Graph images
- [ ] Add sitemap
- [ ] Test all pages and links
- [ ] Verify build succeeds

## New Content Schema

### Blog Post Frontmatter

```yaml
---
title: "Post Title"
description: "Brief description for SEO and previews"
pubDate: 2026-01-13
updatedDate: 2026-01-14  # optional
tags: ["tag1", "tag2"]
hero: "./hero-image.png"  # optional
draft: false  # optional, defaults to false
---
```

### Page Frontmatter

```yaml
---
title: "Page Title"
description: "Page description"
---
```

## Design Considerations

### Typography

- Use system font stack for body text
- Consider a display font for headings
- Ensure good line height and measure for readability

### Color Palette

- Dark mode support from the start
- Use PandaCSS semantic tokens
- Accessible contrast ratios

### Navigation

- Simple top navigation: Home, Blog
- Mobile-friendly hamburger menu or minimal nav

## Success Criteria

- [ ] All existing content renders correctly
- [ ] Site builds without errors
- [ ] Lighthouse performance score > 90
- [ ] All links functional
- [ ] RSS feed works
- [ ] Dark mode toggle works

## Progress Notes

- [2026-01-13](./2026-01-13-progress.md) - Initial planning
