# Code style guide

How code is shaped once you are writing it -- formatting defaults, program structure, argument
passing, and the per-language rules. Which language to write in is
[scripting-style.md](scripting-style.md); which tool enforces what is
[tooling-standard.md](tooling-standard.md); the attitude toward lint findings is
[linting.md](linting.md); test style is [testing.md](testing.md).

## Formatting: formatters own it

Formatting is never hand-maintained -- every language gets a formatter and a linter, wired as mise
tasks and gated in CI. Never hand-format against the formatter, and never argue with it in review;
if the output looks wrong, change the config once, centrally.

Two tiers decide any formatting question:

1. **Language norms win.** rustfmt's 4-space indent, gofmt's tabs, PEP 8's double-ish quoting --
   when the ecosystem has a strong convention, follow it. A file that looks foreign to a fluent
   reader of that language is wrong even if it matches the house defaults.
2. **House defaults fill the gaps.** Where the language leaves a choice open:
   - **Two-space indentation**
   - **Tight spacing** -- no padding inside braces: `{foo}`, not `{ foo }`
   - **No semicolons** wherever the language makes them optional
   - **Single quotes**, except where the ecosystem norm is double (JSX attributes, Rust, Go)
   - **K&R braces** -- opening brace on the same line, closing brace on its own line
   - **100-column lines**, LF endings, trailing commas in multiline literals

For JS/TS the house defaults are already encoded in the root `biome.jsonc` (`quoteStyle: single`,
`semicolons: asNeeded`, `bracketSpacing: false`, `indentWidth: 2`, `lineWidth: 100`) -- run
`mise run format` and you get them for free. Rust and Go use their stock formatters unmodified;
their defaults are the language norms.

## Shape: functional and data-centric

Model the domain as **immutable data plus free functions**, not object graphs.

- **Data is a plain shape**: an `interface` in TypeScript, a `struct` in Rust or Go. Behavior is
  exported functions that take the data and return new data.
- **Co-locate data with its functions.** The type and the functions that operate on it live in the
  same module, tests alongside (`chat-agent.ts` defines `RunAgentInput` and every function that
  consumes one). Organizing by data type, not by layer, keeps a module self-contained.
- **Immutable by default.** `const` everywhere in JS/TS, `readonly` / `ReadonlyArray` in accepted
  types; unannotated (non-`mut`) bindings in Rust. Return new values instead of mutating inputs.
- **Classes must earn their place.** A class makes sense for a genuinely stateful resource with a
  lifecycle, or when a framework demands one. It is never a namespace for functions and never a bag
  of getters over data -- that is an interface plus functions.
- **Pipelines over loops.** Prefer `map` / `filter` / `reduce` and iterator chains -- they state
  what the transformation is, not how to march the index. `for` loops are allowed when performance
  matters or when the loop is genuinely clearer (early exit, scanning backwards), but keep them
  simple: one obvious induction variable, no mutation at a distance, small body.

## Arguments: named and position-independent

Past two parameters -- or the moment two parameters share a type -- switch to named,
position-independent arguments. `move(3, 7)` is unreviewable; `move({x: 3, y: 7})` is not.

- **JS/TS**: a single destructured object parameter, typed by an interface named for its role:
  - `XxxParams` -- inputs to a function
  - `XxxProps` -- inputs to a React component
  - `XxxOptions` -- when most fields are optional knobs with defaults

  ```ts
  export interface ParsePreviewUrlParams {
    prNumber: string
    workerName: string
  }
  export function parsePreviewUrl(stdout: string, {prNumber, workerName}: ParsePreviewUrlParams) {
    // ...
  }
  ```

- **Rust / Go**: a params struct once arity grows (field names at the call site via struct
  literals). Builders only when optionality is deep.
- **Positional is fine** when there is a compelling reason: hot paths where the wrapper object
  costs, arity of one or two with unambiguous meaning (`echoReply(userText)`), or math-shaped
  signatures with a fixed conventional order.

## TypeScript

- **`interface` over `type` for object shapes** -- better error messages and hover output. `type` is
  allowed the moment its features are needed: unions, intersections, mapped or conditional types,
  tuples, function types. Enforced by oxlint `typescript/consistent-type-definitions` (root
  `.oxlintrc.json`), alongside `max-params` and `typescript/consistent-type-imports` for the
  arguments and import rules above.
- **`Prettify<T>`** flattens an intersection- or generic-built type into a readable hover; reach for
  it when a composed type leaks its plumbing:
  ```ts
  type Prettify<T> = {[K in keyof T]: T[K]} & {}
  ```
- **Type-only imports use `import type`** (or inline `type` specifiers); Biome's organize-imports
  keeps them sorted.
- **Named exports.** Default exports only where a framework requires them (Astro pages, config
  files).
- **No `any`, and no `as` to silence the checker.** Fix the type. In tests, prefer
  [shoehorn](https://github.com/total-typescript/shoehorn) (`fromPartial`) over `as` for partial
  test data -- the `/migrate-to-shoehorn` skill exists for exactly this.

## Rust

Safety is paramount, and clippy is the enforcement arm.

- **Turn clippy up, not off**: `clippy::all` plus `clippy::pedantic` via workspace lints in the root
  `Cargo.toml`, warnings denied in CI (`cargo clippy -- -D warnings`). Findings get fixed, never
  `#[allow]`-ed away -- the [linting.md](linting.md) rule applies with full force. (The workspace
  wiring is tracked as aspirational in
  [tooling-standard.md](tooling-standard.md#rust-aspirational--not-yet-implemented); the style
  applies to any Rust written meanwhile.)
- **rustfmt, unmodified.** Its defaults are the language norm and override the house defaults
  (4-space indent, double quotes).
- **No `unwrap` outside tests.** Propagate with `?`, or `expect` with a message stating the
  invariant that makes the failure impossible.
- The shape rules above translate directly: `struct` + `impl` blocks co-located in one module,
  iterator chains over index loops, borrowed immutable data by default.

## Bash

Bash gets a hard budget: **fewer than 10 lines, trivial syntax only** -- straight-line commands, at
most a guard `if`. No functions, no arrays, no parsing of command output. At line 10 (or the first
clever construct) the script is no longer bash: rewrite it as a Bun/TypeScript script in `bin/`, or
-- for a recurring workflow that has outgrown scripting entirely -- a purpose-built utility in Rust
or Go, fronted by a mise task like everything else. Full language order and the `sed`/`perl` ban
live in [scripting-style.md](scripting-style.md).

## References

- [scripting-style.md](scripting-style.md) -- which language a script is written in
- [linting.md](linting.md) -- fix findings, never silence them
- [testing.md](testing.md) -- test style, parameterized tests, runtime gates
- [tooling-standard.md](tooling-standard.md) -- which tool owns which concern
- [file-naming.md](file-naming.md) -- kebab-case rule and exceptions
