#!/usr/bin/env bash
set -euo pipefail

TAG_PREFIX="fw.webex-v"
REPO="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-}"
RELEASE_VERSION="${RELEASE_VERSION:-${1:-}}"
BASE_BRANCH="${RELEASE_BASE_BRANCH:-${2:-main}}"

if [[ -z "$REPO" ]]; then
  echo "GITHUB_REPOSITORY is required" >&2
  exit 1
fi

if [[ -z "$RELEASE_VERSION" ]]; then
  echo "RELEASE_VERSION is required. Provide a version such as 1.0.3." >&2
  exit 1
fi

RELEASE_VERSION="${RELEASE_VERSION#${TAG_PREFIX}}"

if ! [[ "$RELEASE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid RELEASE_VERSION '${RELEASE_VERSION}'. Expected format: MAJOR.MINOR.PATCH." >&2
  exit 1
fi

git fetch origin "$BASE_BRANCH"
git checkout -B "$BASE_BRANCH" "origin/${BASE_BRANCH}"

git fetch --tags --force
latest_tag="$(git tag -l "${TAG_PREFIX}*" --sort=-v:refname | head -n1 || true)"

if [[ -z "$latest_tag" ]]; then
  prev_tag=""
else
  prev_tag="$latest_tag"
fi

new_version="$RELEASE_VERSION"
freeze_tag="${TAG_PREFIX}${new_version}"

if git rev-parse -q --verify "refs/tags/${freeze_tag}" >/dev/null; then
  echo "Tag ${freeze_tag} already exists. Nothing to do."
  exit 0
fi

release_branch="release/${freeze_tag}"
IFS='.' read -r nmajor nminor npatch <<<"$new_version"
next_patch=$((npatch+1))
next_version="${nmajor}.${nminor}.${next_patch}"
develop_branch="develop/${TAG_PREFIX}${next_version}"

# Changelog generation (since previous tag or all commits)
range=""
if [[ -n "${prev_tag}" ]]; then
  range="${prev_tag}..HEAD"
else
  range="HEAD"
fi

commit_log="$(git log --pretty=format:'- %h %s' ${range} || true)"
run_date="$(date -u +%Y-%m-%d)"

if [[ -z "$commit_log" ]]; then
  commit_log="- Sem commits relevantes para registrar"
fi

summary="- Congelamento manual a partir de ${BASE_BRANCH}\n- Tag ${freeze_tag}\n- Branch de release ${release_branch}\n- Início de desenvolvimento em ${develop_branch}"

tmp_file="$(mktemp)"
{
  echo "## ${freeze_tag} - ${run_date}"
  echo
  echo "### Resumo técnico"
  echo -e "$summary"
  echo
  echo "### Commits"
  echo "$commit_log"
  echo
  if [[ -f CHANGELOG.md ]]; then
    cat CHANGELOG.md
  fi
} > "$tmp_file"
mv "$tmp_file" CHANGELOG.md

# Create freeze tag and release branch from main HEAD

git tag -a "$freeze_tag" -m "Freeze fw.webex v${new_version}"
git push origin "$freeze_tag"

git branch "$release_branch" "$freeze_tag"
git push origin "$release_branch"

# Create next development branch from freeze tag
if ! git show-ref --verify --quiet "refs/heads/${develop_branch}"; then
  git branch "$develop_branch" "$freeze_tag"
fi
git push origin "$develop_branch"

# Commit changelog on dedicated branch and open PR to main if changed
if ! git diff --quiet -- CHANGELOG.md; then
  pr_branch="chore/changelog-${freeze_tag}"
  git checkout -B "$pr_branch" "$develop_branch"
  git add CHANGELOG.md
  git commit -m "docs(changelog): update for ${freeze_tag}"
  git push -u origin "$pr_branch"

  if [[ -n "$TOKEN" ]]; then
    api_url="https://api.github.com/repos/${REPO}/pulls"
    existing="$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" \
      "${api_url}?state=open&head=$(echo "$REPO"|cut -d/ -f1):${pr_branch}&base=main")"
    if [[ "$(echo "$existing" | rg -c '"html_url"' || true)" == "0" ]]; then
      payload=$(cat <<JSON
{"title":"docs(changelog): update for ${freeze_tag}","head":"${pr_branch}","base":"main","body":"Atualização automática do CHANGELOG para ${freeze_tag}."}
JSON
)
      curl -sS -X POST "$api_url" -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" -d "$payload" >/dev/null
      echo "PR created for CHANGELOG update."
    else
      echo "PR already exists for ${pr_branch}."
    fi
  else
    echo "GITHUB_TOKEN not provided; skipping PR creation."
  fi
else
  echo "CHANGELOG.md unchanged; skipping PR creation."
fi

echo "Freeze flow completed: ${freeze_tag}"
