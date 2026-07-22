# Configuration file style guide

Where configuration files live, how they're scoped, and what format they're written in. Three
questions, answered in order: **where does it go, how is it scoped, what format.** The guiding
instinct: a config file should be as local, as discoverable-without-clutter, and as expressive as
the tool allows.

This guide is the reference; the live config lives in `.config/`, root `biome.jsonc` /
`.oxlintrc.json` / `.oxfmtrc.json` / `.prettierrc.json`, and each app's `apps/<name>/` configs. For
which tool owns which concern, see [tooling-standard.md](tooling-standard.md).

## 1. Prefer `.config/`; research before defaulting to the repo root

Config belongs in a `.config/` directory whenever the tool can find it there. A clean repo root is a
feature -- it keeps the top level to the things humans navigate to (apps, docs, README) instead of a
scatter of `*rc` clutter.

But "whenever possible" is load-bearing. **Before you place a config at the repo root, verify the
tool genuinely cannot auto-discover it in `.config/`.** Every tool documents its config-resolution
algorithm; read it. The answer falls into three tiers.

### Tier 1 -- auto-discovers `.config/`: put it there

The tool natively searches `.config/<name>` with no extra wiring, so the CLI, CI, and editor
integrations all find it. This is the happy path. In this repo: **cspell** (`.config/cspell.json`,
entry in its `searchPlaces`) and **mise** (`.config/mise.toml`, a documented project-local path) --
both already placed this way.

### Tier 2 -- relocatable only via a flag: default to root, move only with eyes open

The tool's auto-discovery does **not** look in `.config/`; you can point it there only by passing
`--config` / `--config-path` (or an env var) on every invocation. That cost is real and easy to
underestimate: you must thread the flag through every CLI call, every CI step, **and** every editor
integration -- and IDE plugins (Biome, Prettier, Oxlint extensions) frequently ignore a
flag-relocated config and silently fall back to "no config found." A `.config/` placement that
breaks format-on-save is worse than a tidy root.

So for Tier-2 tools the repo root (or the tool's conventional dotfile) is the low-friction default.
Move into `.config/` only if you are prepared to wire the flag through all three surfaces and have
confirmed the editor still resolves it. Keeping a Tier-2 config at root needs **no** justification
-- that IS its documented default. Tier-2 tools in this repo, kept at root deliberately: **Biome**
(`biome.jsonc`), **Oxlint** (`.oxlintrc.json`), **oxfmt** (`.oxfmtrc.json`), **Prettier**
(`.prettierrc.json`), **zizmor** (`.github/zizmor.yml`), **actionlint** (`.github/actionlint.yaml`).

### Tier 3 -- pinned by design: its required spot, permanently

The file's location is load-bearing semantics, not a search path -- it cannot move:

- **EditorConfig** (`.editorconfig`): the directory it sits in defines its scope; tools walk _up_
  from the edited file looking for the literal name. Move it into `.config/` and it would govern
  only files under `.config/`. Permanent root file.
- **Cargo** (`Cargo.toml`): the manifest's directory _is_ the package/workspace root.
  `--manifest-path` repoints but cannot rename or nest it. (`.cargo/config.toml` is a separate Cargo
  settings file in its own `.cargo/` dot-directory -- also not XDG `.config/`.)
- **Renovate** (`.github/renovate.json`): no `.config/` support at all; the off-root location it
  _does_ honor is `.github/`. Use that, not the root.

### The decision in one table

| Tier | Meaning                   | What to do                                                        | Repo examples                                                 |
| ---- | ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | Auto-discovers `.config/` | Put it in `.config/`                                              | cspell, mise                                                  |
| 2    | `.config/` via flag only  | Default to root; move only if you wire CLI + CI + editor + verify | Biome, Oxlint, oxfmt, Prettier, zizmor, actionlint            |
| 3    | Location is semantics     | Leave at its required spot                                        | EditorConfig (root), Cargo.toml (root), Renovate (`.github/`) |

**Before adding any new top-level config, do the Tier check.** "I didn't look" is not Tier 3. Read
the tool's config-resolution docs, then place the file.

## 2. Scope config to the directory it serves

Config lives as close to what it governs as possible; global only when the concern is genuinely
global. The test: if this config changed, what is the blast radius? If it's one app, it belongs in
that app.

- **Project-focused config stays in the project.** An app's Biome / Vite / Playwright / Panda config
  lives in `apps/<name>/`, not at the root. A per-app `biome.json` `extends` the root `biome.jsonc`
  for shared rules and overrides only what is app-specific.
- **Repo-wide config lives at the root scope** (`.config/` or root): the mise toolchain, the root
  Biome / Prettier / Oxlint baseline, the cspell gate.
- **`.config/` nests too** -- it is not a root-only directory.
  `apps/calendar-visualizer/.config/cspell.json` is a per-app cspell config in that app's own
  `.config/`: the same Tier-1 placement, scoped one level down.

If you find a root config that only one app reads, push it down into that app.

## 3. Format preference order

When you control the format -- when the tool accepts more than one -- choose the most expressive
option it supports, in this order. Higher = more types, comments, and composition; lower = more
footguns.

1. **A real programming language** -- TypeScript, Python, Elixir script. Config-as-code: types,
   comments, reuse, computed values, IDE autocomplete and refactoring. A typo becomes a compile/lint
   error instead of a silent 3am failure. Prefer this whenever the tool loads it (`vite.config.ts`,
   `panda.config.ts`, `playwright.config.ts`, `oxlint.config.ts`).
2. **Language object notation** -- a host language's literal data syntax: RON (Rust), ZON (Zig). You
   get that language's native types and comments without executing arbitrary code: declarative, but
   richer and safer than JSON. Use when the ecosystem provides it.
3. **JSONC** -- JSON with comments (and trailing commas). The first portable format that lets you
   explain a setting inline. The default for JSON-family config in this repo (`biome.jsonc`).
   Comments are the whole point -- reach for JSONC over JSON wherever the tool parses it.
4. **TOML** -- comments, obvious types, readable for flat or sectioned config (`mise.toml`,
   `Cargo.toml`). Awkward for deep nesting; great for everything else.
5. **JSON** -- ubiquitous and machine-friendly, but **no comments**. Acceptable only when the tool
   truly speaks JSON alone -- `package.json` is the clear case (npm and pnpm reject comments). Don't
   assume a `.json` extension means strict JSON, though: Oxlint (`.oxlintrc.json`) and Renovate
   (`renovate.json`) both accept JSONC, so annotate them freely rather than treating them as strict
   JSON. Wanting to explain a field you cannot annotate is the signal you wanted JSONC.
6. **YAML** -- last resort, only when a tool mandates it (GitHub Actions, some linters). YAML's
   significant whitespace, type-coercion surprises (the Norway problem: `no` -> `false`), and
   anchor/alias complexity make it the format most likely to bite. Never pick YAML when the tool
   also accepts anything above it.

Rule of thumb: **pick the highest format on this list that the tool accepts natively.** Don't drop
to JSON because it's familiar when the tool reads TypeScript; don't hand-write YAML when JSONC is on
the menu. Placement and format are independent wins that compound -- `.config/foo.ts` beats a root
`foo.yaml` on both axes.

## 4. JavaScript / TypeScript config: TypeScript + ESM

Within the JS ecosystem specifically:

- **TypeScript over JavaScript.** Prefer `*.config.ts` when the tool supports a TS config loader --
  most modern ones do (Vite, Astro, Playwright, Panda, Vitest, Oxlint). Types catch config mistakes
  before runtime.
- **ESM, always.** `import` / `export`, with `"type": "module"` in `package.json`. Never `require` /
  `module.exports`.
- **Bare `.ts` / `.js` first; `.mts` / `.mjs` only when necessary.** The explicit-ESM extensions are
  a workaround for a CJS-default package (no `"type": "module"`) or a tool that demands the explicit
  extension. When the package is already `"type": "module"`, a bare `.ts` _is_ ESM -- use it.
  (`astro.config.mjs` exists for legacy reasons; new configs should be `.ts` where the loader
  allows.)
- **Avoid CJS entirely.** No `.cjs`, no `require()`, no `module.exports` in config. If a tool truly
  only loads CJS, that is the rare documented exception -- note it where it lives.

## Checklist for a new config file

- [ ] **Tier check done?** Read the tool's config-resolution docs. Tier 1 -> `.config/`. Tier 2 ->
      root unless you wire the flag through CLI + CI + editor. Tier 3 -> its required spot.
- [ ] **Scoped to its blast radius?** In the app if it's app-specific; at root only if repo-wide.
- [ ] **Best format the tool accepts?** Highest on the preference list (real language > object
      notation > JSONC > TOML > JSON > YAML).
- [ ] **JS/TS config:** TypeScript, ESM, bare `.ts` (not `.mts` / `.mjs` / `.cjs`) unless a
      constraint forces otherwise.
- [ ] **If it landed at root (Tier 2/3):** is the reason a genuine tool constraint, not convenience?

## References

- [tooling-standard.md](tooling-standard.md) -- which tool owns which concern, per ecosystem
- [scripting-style.md](scripting-style.md) -- language choice for scripts and automation
- [github-actions-style.md](github-actions-style.md) -- workflow conventions (YAML, by mandate)
- [CONTRIBUTING.md](../../CONTRIBUTING.md) -- PR workflow and code conventions
