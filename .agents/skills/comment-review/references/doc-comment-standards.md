# Doc comment standards by language

<!-- Language-specific doc tokens named only in this table. -->
<!-- cSpell:words defp Dokka moduledoc pydoc rdoc -->

Which comment form counts as a doc comment, per language. A doc comment is one a doc generator and
an editor's hover read. Under `docs/contributing/comment-style.md` these belong on the exported
surface of a shared or published package and nowhere else.

## Where the rule applies

| Surface                                                                          | Doc comments |
| -------------------------------------------------------------------------------- | ------------ |
| Exports of `workspaces/web-apps/packages/*` (workspace dependencies of the apps) | Required     |
| Exports of any package published to a registry (npm, crates.io, PyPI, Hex)       | Required     |
| A package's non-exported symbols                                                 | Not allowed  |
| App code under `workspaces/web-apps/apps/*`                                      | Not allowed  |
| Scripts in `bin/`, tests, configs, workflows                                     | Not allowed  |

"Exported" means reachable by an importer: listed in the package's entry point or `exports` map,
`pub` from the crate root, in `__all__` or without a leading underscore at module top level,
capitalized in Go, `def` (not `defp`) in a public Elixir module. A symbol that is `export`ed from an
internal file but never re-exported from the package entry point is not public.

## Format per language

| Language     | Doc comment form                                                                                                                   | Generator or consumer                | Minimal shape                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript   | `/** ... */` immediately above the export ([TSDoc](https://tsdoc.org/))                                                            | TypeDoc, API Extractor, editor hover | Summary sentence; `@param` only when the type does not say it; `@returns` only for a non-obvious contract; `@example` when the call shape is unclear; `@throws` for errors callers must handle |
| JavaScript   | `/** ... */` (JSDoc)                                                                                                               | JSDoc, editor hover                  | Same as TypeScript, plus `@param {Type}` because there are no annotations                                                                                                                      |
| Rust         | `///` above an item; `//!` at crate or module root ([rustdoc](https://doc.rust-lang.org/rustdoc/))                                 | `cargo doc`, docs.rs                 | Summary line, blank line, details; `# Errors`, `# Panics`, `# Safety` sections when they apply; examples compile as doctests                                                                   |
| Python       | A string literal as the first statement ([PEP 257](https://peps.python.org/pep-0257/))                                             | Sphinx, pydoc, editor hover          | One-line summary; a blank line; then `Args:` / `Returns:` / `Raises:` in one consistent style per package                                                                                      |
| Go           | A comment directly above the declaration that begins with the identifier's name ([go.dev/doc/comment](https://go.dev/doc/comment)) | `go doc`, pkg.go.dev                 | "`ParseURL` parses ..." -- the name first, a complete sentence                                                                                                                                 |
| Elixir       | `@moduledoc` and `@doc` attributes ([HexDocs](https://hexdocs.pm/elixir/writing-documentation.html))                               | ExDoc, HexDocs                       | Summary sentence; `## Examples` with `iex>` doctests                                                                                                                                           |
| Java, Kotlin | `/** ... */` (Javadoc, KDoc)                                                                                                       | javadoc, Dokka                       | Summary sentence; `@param`, `@return`, `@throws` only where they add information                                                                                                               |
| C#           | `/// <summary>` XML doc comments                                                                                                   | DocFX, IntelliSense                  | `<summary>` always; `<param>` and `<returns>` only where they add information                                                                                                                  |
| Swift        | `///` Markdown doc comments                                                                                                        | DocC, Xcode Quick Help               | Summary line; `- Parameters:` / `- Returns:` / `- Throws:` only where needed                                                                                                                   |
| Ruby         | `#` comment block above the definition (YARD / RDoc)                                                                               | YARD, rdoc                           | Summary sentence; `@param` / `@return` tags in YARD style                                                                                                                                      |
| Shell        | none                                                                                                                               | none                                 | Scripts get a plain header comment (a recognized edge case), never a doc form                                                                                                                  |

## What the doc comment says

In order, and only the parts that apply:

1. One summary sentence in Simplified Technical English. It names what the symbol does or is, in the
   domain's terms.
2. Facts the signature cannot carry: units, ranges, invariants the caller must keep, the order of
   operations that matters, side effects, the errors it raises and when.
3. An example, when the call shape is not obvious from the types.

Not: a parameter list that restates the types, "Returns the result", "This function is used to",
implementation details a caller cannot observe, or a change history (git has it).

## Recognizing the wrong scope

A doc comment is misplaced when any of these is true:

- The symbol is not reachable from the package's entry point or `exports` map.
- The file lives under an app, `bin/`, a test, or a config directory.
- The symbol is a test helper, a route handler, a component internal to one app, or a local utility
  with one caller.

The fix is to convert it to a plain comment if it says why, or delete it if it only restates the
signature. If someone insists the symbol needs API docs, the guide's edge-case list is where that
argument is settled.
