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
grows with its content, Enter sends, Shift+Enter breaks the line) and `IconButton`.
`panda.config.ts` gains the semantic tokens the shell needs (`bg.surface`/`hover`/`selected`/
`backdrop`, `inverse.bg`/`text`, `focus.ring`). The Playwright suite now covers selection, sending,
new-conversation titling and the small-screen drawer, and the visual baseline was re-recorded.
