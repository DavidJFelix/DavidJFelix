# Contribution Docs

## Goal

Establish lightweight contribution guidelines, changelog tracking, and PR templates for the monorepo. Primary audience is AI agents (Claude Code, GitHub Copilot) that operate on this repo.

## Rationale

- No CONTRIBUTING.md, AGENTS.md, or PR template exists
- No changelog or change tracking beyond project progress files
- Multiple AI tools interact with the repo via GitHub Actions and need clear conventions

## Implementation

### Phase 1: Documentation scaffolding

- Create `CONTRIBUTING.md` at root (short, references other files)
- Create `AGENTS.md` at root (universal AI agent entry point)
- Update `CLAUDE.md` with cross-references

### Phase 2: Changelog structure

- Create `docs/changelog/` with monthly date-partitioned files
- Seed with entries for recent work
- Document the format in `docs/changelog/README.md`

### Phase 3: PR template

- Create `.github/PULL_REQUEST_TEMPLATE.md`
- Enforce conventional commit titles
- Structured body with summary, changes, changelog entry, testing

## Relevant files

- [CLAUDE.md](/CLAUDE.md)
- [CONTRIBUTING.md](/CONTRIBUTING.md)
- [AGENTS.md](/AGENTS.md)
- [PR template](/.github/PULL_REQUEST_TEMPLATE.md)
- [Changelog format](/docs/changelog/README.md)
