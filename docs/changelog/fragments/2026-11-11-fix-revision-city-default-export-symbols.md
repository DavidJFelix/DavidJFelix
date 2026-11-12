### fix(revision.city): give default exports and module-level member assignments a symbol row

The Symbols tab now shows a row for an anonymous `export default` (named `default`), for a
module-level assignment to a member such as `module.exports = ...`, `exports.load = ...` or
`Button.displayName = ...` (named by the member path), and for a TypeScript `declare function`.
Before, a change to a `vite.config.ts` gave "No symbol changes". A named default function or class
keeps its one row.
