# Changelog fragments

Pending changelog entries, one file per PR. Because every PR adds its own file here instead of
editing the top of the current month's file, parallel branches never conflict on the changelog.

The roll-up (`mise run changelog:rollup`) folds every fragment into the right monthly
`docs/changelog/YYYY-MM.md` file and deletes it afterwards; this README is the only permanent
resident of the directory. The monthly files are only ever written by the roll-up -- never edit them
directly.

## Naming

`YYYY-MM-DD-<type>-<scope>-<short-slug>.md`, lowercase kebab-case throughout:

- `YYYY-MM-DD` -- the date of the change (today's date when you open the PR)
- `<type>` -- the conventional commit type (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`)
- `<scope>` -- the app or area name, with dots flattened to hyphens (`djf.io` becomes `djf-io`)
- `<short-slug>` -- a few words identifying the change

Example: `2026-07-03-feat-tooling-changelog-fragment-workflow.md`.

## Content

Exactly one entry in the monthly-file format -- a `### type(scope): description` heading followed by
the prose paragraphs:

```markdown
### fix(djf.io): stop the header collapsing on scroll

Context about what changed and why.
```

Rules the roll-up enforces:

- The entry starts with a `###` heading; `#` and `##` headings are reserved for the monthly files
  (fenced code blocks are exempt).
- Content is folded into the monthly file byte-for-byte, so write it exactly as it should appear
  there: Prettier-formatted (`proseWrap: always`, 100 columns) -- `mise run format:md` checks it,
  and the `ci-docs` workflow gates it.
