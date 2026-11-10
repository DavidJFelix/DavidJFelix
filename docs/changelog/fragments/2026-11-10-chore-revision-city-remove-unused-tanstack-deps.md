### chore(revision.city): remove six unused TanStack dependencies

revision.city no longer lists `@tanstack/react-form`, `@tanstack/react-hotkeys`,
`@tanstack/react-query`, `@tanstack/react-store`, `@tanstack/react-virtual` or `@tanstack/store`. No
file in the app imports them. The unused lezer grammars stay for semantic diffing, and
`@ark-ui/react` stays because the UI components move from Radix to Ark.
