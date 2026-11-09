### chore(revision.city): remove ten unused dependencies

revision.city no longer lists `@ark-ui/react`, `@lezer/html`, `@lezer/lezer`, `@lezer/xml`,
`@tanstack/react-form`, `@tanstack/react-hotkeys`, `@tanstack/react-query`, `@tanstack/react-store`,
`@tanstack/react-virtual` or `@tanstack/store`. No file in the app imports them. The UI primitives
are Radix, so the plan's stack line now says Radix, not Ark. `@lezer/highlight` stays as a direct
entry, because it keeps one version for all grammars.
