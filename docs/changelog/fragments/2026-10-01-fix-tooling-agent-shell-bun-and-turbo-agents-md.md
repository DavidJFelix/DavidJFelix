### fix(tooling): pin the agent tool shell to mise's bun and stop turbo writing AGENTS.md

The session-start hook persisted mise activation only through `BASH_ENV`, which reaches child bash
shells but not the Claude Code tool shell itself, because Claude Code sources `CLAUDE_ENV_FILE` into
that shell after it starts. A bare `bun` there resolved to the container's unpinned bun, and a
`bun install` with it rewrote `bun.lock` to an older lockfile version. The hook now also writes a
`source` line for `.config/mise-agent-env.bash`, so the tool shell gets the mise-pinned toolchain
too.

turbo 2.11 writes a managed block into an `AGENTS.md` beside the root `turbo.json` whenever it
detects an AI agent, and one such file was committed by accident. `workspaces/web-apps/turbo.json`
now sets `agentGuidance: false`.
