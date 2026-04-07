if status is-interactive
  # Commands to run in interactive sessions can go here
end

# Aliases
alias la='eza -la'
alias ll='eza -lh'

# Bin linking
eval "$(/opt/homebrew/bin/brew shellenv)"
fish_add_path $HOME/.local/bin

# Mise-en-place setup
mise activate fish | source
