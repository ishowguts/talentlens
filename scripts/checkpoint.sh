#!/usr/bin/env sh
# Save a work-in-progress checkpoint so the next session can resume from it.
# Usage: scripts/checkpoint.sh T07 "vector search endpoint returns results, tests pending"
set -e
TASK="$1"; shift || true
NOTE="$*"
if [ -z "$TASK" ] || [ -z "$NOTE" ]; then
  echo 'usage: scripts/checkpoint.sh <TASK-ID> "<what is done / what is next>"'; exit 2
fi
if git diff --quiet HEAD -- harness/HANDOFF.md 2>/dev/null; then
  echo "checkpoint: harness/HANDOFF.md is unchanged. Update the Active session block first."; exit 1
fi
git add -A
git commit -m "wip($TASK): $NOTE"
git push 2>/dev/null || echo "checkpoint: committed locally (push failed or no remote, push later)."
