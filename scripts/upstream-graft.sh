#!/usr/bin/env bash
#
# Restores the link to the FoE Helfer history as local grafts.
#
# Usage: scripts/upstream-graft.sh
#
# The published history has no Helfer commits: the import and every later
# upstream update are single-parent commits. Git still needs the Helfer commit
# each of them is based on to find the merge base for the next update. This
# script records that as `git replace --graft <commit> <parent> <helfer>` under
# refs/replace/, which `git push` does not send.
#
#   import commit   1412cbba8, based on Helfer f24d1fd4 (v4.8.3.0)
#   updates         every commit with a trailer `Upstream: <helfer sha>`
#
# Run it once per clone after `git fetch upstream`, and again after committing
# an update. Running it twice changes nothing.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

graft() {
	local commit="$1" helfer="$2" parent
	git rev-parse -q --verify "$helfer^{commit}" >/dev/null || {
		echo "unknown Helfer commit $helfer for $commit, run git fetch upstream" >&2
		exit 1
	}
	parent="$(git rev-parse "$commit^1")"
	git replace -f --graft "$commit" "$parent" "$helfer"
	echo "$(git rev-parse --short "$commit") -> $(git rev-parse --short "$helfer")"
}

graft 1412cbba8aa615b43793616300068967ac83818f f24d1fd4e9f527b609d444d691d4410b6f43bfe6

# Grafts hide the real parents, so read the trailers without them.
git --no-replace-objects log --format='%H %(trailers:key=Upstream,valueonly,separator=%x20)' HEAD |
	while read -r commit helfer; do
		if [ -n "$helfer" ]; then graft "$commit" "$helfer"; fi
	done
