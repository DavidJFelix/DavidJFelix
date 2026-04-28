# Dotfiles Overhaul

## Goal

Dramatically update `dotfiles/`. Move shell from oh-my-zsh to fish, sync local config back into the repo, and modernize the setup.

## Initial Scope (non-exhaustive)

- Fish config
- Nushell config
- Git config
- jj config
- Aliases
- Starship config
- Brewfile
- Package inventory — what is actually being used
- Remove omz

## Working Notes

- User wants pushback and active scanning during execution; do not just translate the list above into commits. Audit current state, surface gaps, and challenge assumptions before changing things.
- `dotfiles/` already contains Brewfile(s), `iterm2/`, `scripts/`, and `.config/fish` — start by inventorying what exists vs. what's actually in use locally.

## Related

- `dotfiles/` at repo root
