#!/usr/bin/env bash
#
# Checks the toolbox changes in upstream files, mainly after an upstream merge.
#
# Usage: scripts/toolbox-check.sh [--upstream <old>..<new>] [base]
#
#   base        upstream state the toolbox is compared to. Default: merge base
#               of HEAD and upstream/master, fallback f24d1fd4 (Helfer 4.8.3.0).
#   --upstream  upstream range for (b) and (c). Default: base..upstream/master,
#               which is the new upstream work before a merge. After a merge:
#               $(git merge-base ORIG_HEAD upstream/master)..upstream/master
#
# Reports:
#   (a) unmarked changes. For every file that exists in base and HEAD and is not
#       on the allowlist, each hunk of `git diff -U0 base HEAD` must have the word
#       TOOLBOX in its HEAD lines, in the line directly before or after them, or
#       lie inside a TOOLBOX-BEGIN/TOOLBOX-END block of the HEAD file. A hunk that
#       only removes lines is checked on the two HEAD lines around the removal.
#   (b) wrapped upstream functions (scripts/toolbox-wraps.txt) whose definition
#       changed in the upstream range. The body runs from the definition line to
#       the next line that is not indented deeper (a closing bracket on that line
#       belongs to the body). "cannot locate" if the definition is missing or
#       ambiguous.
#   (c) paths the toolbox deleted that upstream changed in the range. They show
#       up as modify/delete conflicts in a merge, resolve them with `git rm`.
#
# Exit code 1 if (a) or (b) reports something, 2 on usage errors.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Files without comments: the toolbox changes there are not marked.
ALLOWLIST=(
	'*.json'
	'*.md'
	'images/*'
)

upstream_range=''
base=''
while [ $# -gt 0 ]; do
	case "$1" in
		--upstream) upstream_range="${2:-}"; shift 2 || { echo "--upstream needs <old>..<new>" >&2; exit 2; } ;;
		-h|--help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) base="$1"; shift ;;
	esac
done

if [ -z "$base" ]; then
	base="$(git merge-base HEAD upstream/master 2>/dev/null || echo f24d1fd4)"
fi
[ -n "$upstream_range" ] || upstream_range="$base..upstream/master"
case "$upstream_range" in
	*..*) ;;
	*) echo "--upstream needs <old>..<new>" >&2; exit 2 ;;
esac
for rev in "$base" "${upstream_range%%..*}" "${upstream_range##*..}"; do
	git rev-parse -q --verify "$rev^{commit}" >/dev/null || { echo "unknown revision: $rev" >&2; exit 2; }
done

python3 - "$base" "${upstream_range%%..*}" "${upstream_range##*..}" "${ALLOWLIST[@]}" <<'PY'
import fnmatch, re, subprocess, sys

base, up_old, up_new, allowlist = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]


def git(*args):
	return subprocess.run(('git',) + args, check=True, capture_output=True, text=True).stdout


def show(rev, path):
	r = subprocess.run(['git', 'show', f'{rev}:{path}'], capture_output=True, text=True)
	return r.stdout.splitlines() if r.returncode == 0 else None


def name_status(a, b):
	for line in git('diff', '--no-renames', '--name-status', a, b).splitlines():
		status, path = line.split('\t', 1)
		yield status, path


found = False

# (a) unmarked changes
print(f'(a) unmarked changes (base {base[:10]})')
for status, path in name_status(base, 'HEAD'):
	if status != 'M' or any(fnmatch.fnmatch(path, p) for p in allowlist):
		continue
	lines = show('HEAD', path)
	in_block, depth = [], 0
	for line in lines:
		if 'TOOLBOX-BEGIN' in line:
			depth += 1
		in_block.append(depth > 0)
		if 'TOOLBOX-END' in line:
			depth = max(depth - 1, 0)
	for h in re.finditer(r'^@@ -\S+ \+(\d+)(?:,(\d+))? @@', git('diff', '-U0', base, 'HEAD', '--', path), re.M):
		start, count = int(h.group(1)), int(h.group(2) or 1)
		# removed only: git names the HEAD line before the gap
		first, last = (start, start + 1) if count == 0 else (start - 1, start + count)
		window = range(max(first, 1) - 1, min(last, len(lines)))
		if not any('TOOLBOX' in lines[i] or in_block[i] for i in window):
			found = True
			end = start + max(count, 1) - 1
			print(f'  {path}:{start}' + (f'-{end}' if end != start else '') + (' (removed lines)' if count == 0 else ''))

# (b) wrapped functions changed upstream
def body(lines, name):
	if lines is None:
		return None
	pat = re.compile(r'^(\s*)(?:async\s+)?' + re.escape(name) + r'\s*(?::|=|\()|function\s+' + re.escape(name) + r'\b')
	hits = [i for i, l in enumerate(lines) if pat.search(l)]
	if len(hits) != 1:
		return None
	i = hits[0]
	indent = len(lines[i]) - len(lines[i].lstrip())
	out = [lines[i]]
	for l in lines[i + 1:]:
		if l.strip() and len(l) - len(l.lstrip()) <= indent:
			if l.lstrip()[:1] in '})]':
				out.append(l)
			break
		out.append(l)
	return out

print(f'(b) wrapped functions changed upstream ({up_old}..{up_new})')
with open('scripts/toolbox-wraps.txt') as f:
	for line in f:
		line = line.rstrip('\n')
		if not line.strip() or line.startswith('#'):
			continue
		func, path = line.split('\t')
		name = func.rsplit('.', 1)[-1]
		old, new = body(show(up_old, path), name), body(show(up_new, path), name)
		if old is None or new is None:
			found = True
			print(f'  cannot locate: {func} in {path} ({up_old if old is None else up_new})')
		elif old != new:
			found = True
			print(f'  changed: {func} in {path}')

# (c) deleted paths changed upstream
print('(c) deleted paths changed upstream (resolve with git rm)')
deleted = {p for s, p in name_status(base, 'HEAD') if s == 'D'}
for path in sorted(deleted & set(git('diff', '--no-renames', '--name-only', up_old, up_new).splitlines())):
	print(f'  {path}')

sys.exit(1 if found else 0)
PY
