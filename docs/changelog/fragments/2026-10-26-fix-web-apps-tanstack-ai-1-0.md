### fix(web-apps): move f311x and onvibes.org to TanStack AI 1.0

The Renovate TanStack AI group moves `@tanstack/ai` and `@tanstack/ai-react` to 1.0.0 in f311x and
onvibes.org, and `@tanstack/ai-openrouter` to 1.0.0 in onvibes.org. In 1.0, `useChat` and `chat()`
need a `threadId`. With only the version change, the typecheck fails in both apps.

The f311x chat page now makes a thread id with `crypto.randomUUID()` when it mounts and gives it to
`useChat`. The onvibes.org chat route gives the thread id from the request to `chat()`. If the
request has no thread id, the route makes a new one. The request contract does not change: the
thread id stays optional, and the onvibes.org client always sends the id of its conversation.
