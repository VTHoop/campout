# Sourced by Lefthook before running hooks. Keeps user-local tool paths (the
# CodeScene `cs` CLI installs to ~/.local/bin) visible to hook jobs.
[ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"
