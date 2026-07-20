# shellcheck shell=bash
for _mise_agent_bin in "$HOME/.local/bin" /opt/homebrew/bin /usr/local/bin; do
  [[ -d "$_mise_agent_bin" && ":$PATH:" != *":$_mise_agent_bin:"* ]] && PATH="$_mise_agent_bin:$PATH"
done
export PATH
_mise_agent_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
[[ ":${MISE_TRUSTED_CONFIG_PATHS:-}:" == *":$_mise_agent_root:"* ]] || export MISE_TRUSTED_CONFIG_PATHS="${MISE_TRUSTED_CONFIG_PATHS:+$MISE_TRUSTED_CONFIG_PATHS:}$_mise_agent_root"
command -v mise >/dev/null 2>&1 && eval "$(mise activate bash --quiet)"
unset _mise_agent_bin _mise_agent_root
