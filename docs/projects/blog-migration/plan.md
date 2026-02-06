# Blog Migration Plan

## Goal

Migrate djf.io from Starlight to a custom Astro + MDX + PandaCSS setup for greater control over layout, styling, and site structure.

## Rationale

- Starlight is designed for documentation sites with specific conventions
- Custom setup allows more flexibility for a personal blog/portfolio
- PandaCSS is already configured but underutilized with Starlight's built-in styles
- Greater control over page layouts, navigation, and design

## Current State

- **Framework**: Astro 5 with MDX, React, and PandaCSS
- **Content**: 3 blog posts (.md) in `src/content/blog/`
- **Styling**: PandaCSS with zinc color palette, dark theme
- **Layouts**: BaseLayout + BlogPost layout
- **Pages**: Home, blog index, dynamic post routes, RSS feed
- **Starlight**: Fully removed
- **Location**: `apps/djf.io/`

### Current Content

| File | Type | Description |
|------|------|-------------|
| `src/pages/index.astro` | Home | About page with bio, career history, AI disclaimer |
| `src/content/blog/2023-12-30-shipposting.md` | Blog | On shipping products |
| `src/content/blog/2024-4-26-on-positivity.md` | Blog | On being constructively critical |
| `src/content/blog/2025-12-07-on-running.md` | Blog | Marathon training reflections |

## Migration Phases

### Phase 1: Project Setup - COMPLETE

- [x] Create new content collection schema for blog posts
- [x] Update `src/content/config.ts` to remove Starlight schemas

### Phase 2: Layout System - COMPLETE

- [x] Create base layout component (`src/layouts/BaseLayout.astro`)
- [x] Create blog post layout (`src/layouts/BlogPost.astro`)
- [x] Implement responsive navigation in BaseLayout
- [x] Implement footer in BaseLayout

### Phase 3: Styling Foundation - COMPLETE

- [x] PandaCSS configured with zinc color palette
- [x] Dark theme implemented
- [x] Navigation styled
- [x] Blog post layout styled (headings, paragraphs, links, blockquotes, code blocks, lists)

### Phase 4: Content Migration - COMPLETE

- [x] Move blog posts from `src/content/docs/blog/` to `src/content/blog/`
- [x] Update frontmatter schema for blog posts
- [x] Convert home page to use new layout

### Phase 5: Page Routes - COMPLETE

- [x] Create home page (`src/pages/index.astro`)
- [x] Create blog index page (`src/pages/blog/index.astro`)
- [x] Create dynamic blog post route (`src/pages/blog/[...slug].astro`)
- [x] Set up RSS feed (`src/pages/rss.xml.ts`)
- [x] Create tag listing page (`src/pages/blog/tags/index.astro`)
- [x] Create dynamic tag archive route (`src/pages/blog/tags/[tag].astro`)

### Phase 6: Search

- [ ] Install Pagefind (`pagefind` package)
- [ ] Configure Pagefind to index at build time
- [ ] Create search UI component
- [ ] Style search modal/dropdown with PandaCSS
- [ ] Add search trigger to navigation

**Why Pagefind:**
- Same search engine Starlight uses under the hood
- Framework-agnostic (no Starlight coupling)
- Indexes at build time (static, fast, no server)
- Tiny runtime (~5kb gzipped)
- Supports filtering by tags, dates, etc.

### Phase 7: Remove Starlight - COMPLETE

- [x] Remove `@astrojs/starlight` from dependencies
- [x] Update `astro.config.mjs` to remove Starlight integration
- [x] Clean up Starlight-specific files
- [x] Remove `src/content/docs/` directory

### Phase 8: Testing

- [ ] Set up Vitest for unit testing
- [ ] Set up Playwright for E2E testing
- [ ] Add unit tests for utility functions (date formatting, tag extraction, etc.)
- [ ] Add E2E tests for critical user flows
- [ ] Configure CI to run tests on PR

**Test Coverage:**

| Type | Tool | What to Test |
|------|------|--------------|
| Unit | Vitest | Date/time formatting, slug generation, tag utilities |
| E2E | Playwright | Page loads, navigation, search, tag filtering, RSS validity |

**E2E Test Scenarios:**
- Home page renders with bio content
- Blog index shows all posts
- Individual blog post renders with correct content
- Tag page filters posts correctly
- Search finds posts by title and content
- RSS feed is valid XML with correct entries
- All internal links resolve (no 404s)

### Phase 9: Polish

- [ ] Add SEO meta tags
- [ ] Implement Open Graph images
- [ ] Add sitemap
- [ ] Verify build succeeds
- [ ] Run full test suite

## Content Schema

### Blog Post Frontmatter

```yaml
---
title: "Post Title"
description: "Brief description for SEO and previews"
date: 2026-01-13
author: "DavidJFelix"  # optional
tags: ["tag1", "tag2"]  # optional
readingTime: "5m"  # optional
hero:  # optional
  tagline: "Hero tagline"
  image: "./hero-image.png"
aiAssistants:  # optional
  - name: "Anthropic Claude"
    details: "How AI assisted"
draft: false  # optional, defaults to false
---
```

## Design Considerations

### Typography

- System font stack for body text
- Good line height and measure for readability

### Color Palette

- Dark theme with zinc color palette via PandaCSS
- Accessible contrast ratios

### Navigation

- Top navigation: Home, Blog, GitHub, Twitter
- Responsive layout

### Blog Index

- Posts sorted by date (newest first)
- Shows post title, date, tags, description, reading time

### Tag System

- `/blog/tags/` - Lists all tags with post counts
- `/blog/tags/[tag]` - Shows all posts with that tag
- Tags displayed on post cards and post pages
- Clickable tags link to tag archive

### Search

- Pagefind for static, build-time indexing
- Search modal triggered from nav
- Keyboard accessible (Cmd/Ctrl+K shortcut)

## Success Criteria

- [x] All existing content renders correctly
- [x] Site builds without errors
- [ ] Lighthouse performance score > 90
- [x] All links functional
- [x] RSS feed works
- [ ] Search indexes all blog content
- [x] Tag pages list correct posts
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] CI pipeline runs tests on PR

## Progress Notes

- [2026-01-13](./2026-01-13-progress.md) - Initial planning
- [2026-02-06](./2026-02-06-progress.md) - Audit and plan update
