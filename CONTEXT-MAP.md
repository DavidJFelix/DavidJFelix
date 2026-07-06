# Context map

This repo uses a **multi-context** layout: each app keeps its own `CONTEXT.md` (domain language +
design decisions) and `docs/adr/` (architecture decisions). System-wide decisions live in the root
`docs/adr/`. See [docs/agents/domain.md](docs/agents/domain.md) for how agents consume these.

## Contexts

| Context                       | `CONTEXT.md`                                     | ADRs                                           |
| ----------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Repository organization       | [CONTEXT.md](CONTEXT.md)                         | [docs/adr/](docs/adr/)                         |
| djf.io (personal site + blog) | [apps/djf.io/CONTEXT.md](apps/djf.io/CONTEXT.md) | [apps/djf.io/docs/adr/](apps/djf.io/docs/adr/) |

Add a row when a new app grows context worth recording. Apps without a `CONTEXT.md` simply aren't
listed yet -- created lazily as terms and decisions get resolved.
