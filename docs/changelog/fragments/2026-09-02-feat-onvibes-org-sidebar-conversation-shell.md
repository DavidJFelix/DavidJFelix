### feat(onvibes.org): replace the landing page with a sidebar + conversation shell

onvibes.org no longer opens on a marketing landing. The root route is now the app shell: a sidebar
listing conversations (title, last-message preview, compact age) beside the selected conversation,
with a composer at the bottom. Nothing is wired to a backend yet -- the conversations are fixture
data in `src/lib/conversations.ts`, and selecting, starting a new conversation, and sending a
message are client state that flows through pure functions (`appendMessage`, `replaceConversation`,
`titleFrom`) with co-located unit tests, so the TanStack AI wiring can swap the store without
touching the components.

The shell is built from small Panda-styled components under `src/components/`: `AppShell` (fixed
sidebar column from `md` up, off-canvas drawer with scrim and Escape-to-close below it), `Sidebar`,
`ConversationView` (header, scrolling thread, empty state for a fresh conversation), `MessageBubble`
(assistant in plain text beside a mark, user in an inverted bubble), `Composer` (a textarea that
grows with its content, Enter sends, Shift+Enter breaks the line) and `IconButton`. Icons come from
`lucide-react` (pinned to revision.city's version), which also replaces the theme toggle's
hand-drawn sun/moon/monitor glyphs. `panda.config.ts` gains the semantic tokens the shell needs
(`bg.surface`/`hover`/`selected`/`backdrop`, `inverse.bg`/`text`, `focus.ring`).

Tests land at three levels, every body structured as explicit given/when/then. The pure model keeps
its jsdom unit tests. Every component has a co-located `.test.tsx` that renders in real Chromium
through Vitest browser mode (`@vitest/browser-playwright` + `vitest-browser-react`, a second
`browser` project in `vitest.config.ts` that loads the app stylesheet so Panda's CSS is live), so
the tests assert real layout: the drawer off-canvas below `md` and beside main above it, a long
title truncating inside its row, the newest message scrolled into view, the textarea growing with
its draft. That last one caught a real bug -- the callback ref that fits the textarea to its draft
had been hoisted to module scope, so React ran it once on mount and the textarea never regrew.
`index.e2e.test.ts` covers the happy paths (selection, sending, new-conversation titling, the
drawer) with the visual baseline re-recorded, and a new `conversation-shell.e2e.test.ts` covers the
interaction contract: keyboard operation, Shift+Enter, scroll-to-newest, every drawer close path,
plus dark-mode and small-screen drawer baselines.
