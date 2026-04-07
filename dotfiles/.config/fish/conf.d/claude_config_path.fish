# Sets claude code based on project to enable multiple claude logins
function __claude_config_env_hook --on-variable PWD
  if string match -q "$HOME/Programming/*" $PWD
    set -l project (string replace "$HOME/Programming/" "" $PWD | string split -f1 /)
    set -l config_dir "$HOME/Programming/$project/.config/cursor"
    set -gx CLAUDE_CONFIG_DIR "$HOME/Programming/brain-ca/.config/claude"
  else
    set -e CLAUDE_CONFIG_DIR
  end
end

# Also run once on shell startup
__claude_config_env_hook
