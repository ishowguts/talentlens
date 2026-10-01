#!/usr/bin/env sh
# One-time setup after cloning. Run from the repo root (Git Bash on Windows).
# Pins the commit identity to the owner and turns on the ownership guard hooks.
set -e
git config --local user.name "Bittu Mandal"
git config --local user.email "209128489+ishowguts@users.noreply.github.com"
git config --local core.hooksPath .githooks
git config --local format.signOff false
chmod +x .githooks/* scripts/*.sh 2>/dev/null || true
if git rev-parse --verify -q HEAD >/dev/null; then node scripts/guard.mjs all; fi
echo "setup: identity pinned, guard hooks active."
