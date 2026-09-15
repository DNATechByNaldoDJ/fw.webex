#!/usr/bin/env bash
set -euo pipefail

TAG_PREFIX="fw.webex-v"
REPO="${GITHUB_REPOSITORY:-}"
RELEASE_VERSION="${RELEASE_VERSION:-${1:-}}"

if ! [[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "GITHUB_REPOSITORY is required in OWNER/REPO format." >&2
  exit 1
fi

if [[ "${RELEASE_BASE_BRANCH:-${2:-main}}" != "main" ]]; then
  echo "Releases must come from main." >&2
  exit 1
fi

RELEASE_VERSION="${RELEASE_VERSION#${TAG_PREFIX}}"
if ! [[ "$RELEASE_VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Invalid RELEASE_VERSION '${RELEASE_VERSION}'. Expected MAJOR.MINOR.PATCH (example: 1.0.3)." >&2
  exit 1
fi

command -v gh >/dev/null || { echo "GitHub CLI (gh) is required." >&2; exit 1; }

freeze_tag="${TAG_PREFIX}${RELEASE_VERSION}"

# Read the published main without checking out or resetting the working branch.
# Conflicting tags must fail the fetch rather than overwrite a released version.
git fetch --no-recurse-submodules origin refs/heads/main:refs/remotes/origin/main --tags
main_commit="$(git rev-parse --verify 'refs/remotes/origin/main^{commit}')"
remote_tag="$(git ls-remote --tags origin "refs/tags/${freeze_tag}")"

release_commit="$main_commit"
if git show-ref --verify --quiet "refs/tags/${freeze_tag}"; then
  release_commit="$(git rev-parse --verify "refs/tags/${freeze_tag}^{commit}")"
  if ! git merge-base --is-ancestor "$release_commit" "$main_commit"; then
    echo "Tag ${freeze_tag} is outside main history; refusing to publish it." >&2
    exit 1
  fi
fi

# Check API access before publishing anything. Unlike a failed release lookup,
# an empty successful listing distinguishes an absent release from an API error.
release_url="$(gh api --paginate "repos/${REPO}/releases?per_page=100" \
  --jq ".[] | select(.tag_name == \"${freeze_tag}\") | if .draft then error(\"Existing release is a draft; publish or remove it before retrying.\") else .html_url end")"

if [[ -n "$release_url" ]]; then
  if [[ -z "$remote_tag" ]]; then
    echo "Release ${freeze_tag} exists without its remote tag; refusing to recreate the tag." >&2
    exit 1
  fi
  echo "Release already published: ${release_url}"
  exit 0
fi

if ! git show-ref --verify --quiet "refs/tags/${freeze_tag}"; then
  git tag -a "$freeze_tag" "$release_commit" -m "Release fw.webex v${RELEASE_VERSION}"
fi

# A retry reuses the original tag, even if main has advanced in the meantime.
git push origin "refs/tags/${freeze_tag}"
gh release create "$freeze_tag" --repo "$REPO" --verify-tag \
  --target "$release_commit" --title "fw.webex v${RELEASE_VERSION}" --generate-notes

echo "Release published: ${freeze_tag} (${release_commit})"
