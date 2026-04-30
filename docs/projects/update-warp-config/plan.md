# Update Warp Config

## Goal

Bring Warp's configuration in line with the rest of the dev environment by pulling configuration items from dotfiles and updating them.

## Scope

- Inventory existing dotfiles config that should also apply to Warp (shell init, prompt, aliases, env vars, keybindings, themes).
- Decide what belongs in Warp-native config (workflows, launch configs, themes, AI rules) vs. what should stay in shared shell dotfiles.
- Migrate the relevant items into Warp's config and verify they work.
- Sync Warp-native config back into the dotfiles repo so it's version-controlled.

## Dependencies

- [Setup Warp](../setup-warp/plan.md) — CLI installed and basic exploration done first.
- [Dotfiles Overhaul](../dotfiles-overhaul/plan.md) — coordinate with shell migration (omz → fish), starship, nushell so Warp picks up the right shell setup.
