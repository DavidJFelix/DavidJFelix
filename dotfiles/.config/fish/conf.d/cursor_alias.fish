# This hook enables a project-aware cursor configuration, to allow multiple cursor logins and extension configurations
# To use it, simply create a new project in the $HOME/Programming directory and fish will inject the correct configuration directory into the cursor cli command.
# Executing `cursor .` inside a directory like ~/Programming/my-org/myproject will use my-org/.config for the cursor config
function __cursor_alias_hook --on-variable PWD
  # Define the function fresh each time PWD changes
  if string match -q "$HOME/Programming/*" $PWD
    set -l project (string replace "$HOME/Programming/" "" $PWD | string split -f1 /)
    set -l config_dir "$HOME/Programming/$project/.config/cursor"
    function cursor
      command cursor --user-data-dir="$config_dir" --extensions-dir="$config_dir/extensions" $argv
    end
  else if string match -q "$HOME/*" $PWD; or test "$PWD" = "$HOME"
    function cursor
      command cursor --user-data-dir="$HOME/.config/cursor" --extensions-dir="$HOME/.config/cursor/extensions" $argv
    end
  end
end

# Also run once on shell startup
__cursor_alias_hook
