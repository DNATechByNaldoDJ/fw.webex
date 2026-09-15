"""Offline integration checks for the tag-only release command.

Run with: python -m unittest discover -s scripts/tests
Every Git remote is a temporary local bare repository; gh is a shell stub.
"""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


RELEASE_SCRIPT = Path(__file__).resolve().parents[1] / "release_freeze.sh"
GIT_BASH = Path(r"C:\Program Files\Git\bin\bash.exe")
BASH = str(GIT_BASH) if os.name == "nt" and GIT_BASH.is_file() else shutil.which("bash")
TAG = "fw.webex-v1.0.3"
REPOSITORY = "example/fw.webex"

GH_STUB = r'''#!/usr/bin/env bash
set -euo pipefail
state="${GH_STUB_STATE:?}"
count=0
if [[ -f "$state/count" ]]; then
  read -r count < "$state/count"
fi
count=$((count + 1))
printf '%s\n' "$count" > "$state/count"
printf '%s\0' "$@" > "$state/call-$count"
case "${1:-}" in
  api)
    if [[ -f "$state/fail-api" ]]; then
      echo 'injected API failure' >&2
      exit 1
    fi
    if [[ -f "$state/release-exists" ]]; then
      printf '%s\n' 'https://github.com/example/fw.webex/releases/tag/fw.webex-v1.0.3'
    fi
    ;;
  release)
    if [[ "${2:-}" != create ]]; then
      echo 'unexpected gh release operation' >&2
      exit 2
    fi
    if [[ -f "$state/fail-create" ]]; then
      echo 'injected release creation failure' >&2
      exit 1
    fi
    touch "$state/release-exists"
    printf '%s\n' 'https://github.com/example/fw.webex/releases/tag/fw.webex-v1.0.3'
    ;;
  *)
    echo 'unexpected gh operation' >&2
    exit 2
    ;;
esac
'''


@unittest.skipUnless(BASH and shutil.which("git"), "Git and Bash are required")
class ReleaseFreezeIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="fw-webex-release-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.remote = self.root / "origin.git"
        self.seed = self.root / "seed"
        self.work = self.root / "work"
        self.stub_bin = self.root / "bin"
        self.state = self.root / "gh-state"
        self.stub_bin.mkdir()
        self.state.mkdir()
        stub = self.stub_bin / "gh"
        stub.write_text(GH_STUB, encoding="utf-8", newline="\n")
        stub.chmod(0o755)

        self.env = os.environ.copy()
        # Prevent the caller's release settings or Git identity/configuration
        # from affecting these repositories or invoking signing tools.
        for name in tuple(self.env):
            if name.startswith("GIT_") or name in (
                "RELEASE_VERSION", "RELEASE_BASE_BRANCH", "GITHUB_REPOSITORY"
            ):
                self.env.pop(name)
        self.env.update({
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_AUTHOR_NAME": "Release Test",
            "GIT_AUTHOR_EMAIL": "release-test@example.invalid",
            "GIT_COMMITTER_NAME": "Release Test",
            "GIT_COMMITTER_EMAIL": "release-test@example.invalid",
            "GIT_TERMINAL_PROMPT": "0",
            "GITHUB_REPOSITORY": REPOSITORY,
            "GH_STUB_STATE": self.state.as_posix(),
            "PATH": str(self.stub_bin) + os.pathsep + self.env.get("PATH", ""),
        })
        self.git("init", "--bare", "--initial-branch=main", str(self.remote), cwd=self.root)
        self.git("init", "--initial-branch=main", str(self.seed), cwd=self.root)
        (self.seed / "CHANGELOG.md").write_text("Existing changelog\n", encoding="utf-8")
        (self.seed / "tracked.txt").write_text("Initial contents\n", encoding="utf-8")
        self.git("add", ".", cwd=self.seed)
        self.git("commit", "-m", "Initial main", cwd=self.seed)
        self.git("remote", "add", "origin", str(self.remote), cwd=self.seed)
        self.git("push", "origin", "main", cwd=self.seed)
        self.git("clone", str(self.remote), str(self.work), cwd=self.root)
        self.main_commit = self.git("rev-parse", "HEAD")

    def git(self, *args, cwd=None, check=True):
        result = subprocess.run(
            ["git", "-c", "core.autocrlf=false", "-c", "commit.gpgSign=false",
             "-c", "tag.gpgSign=false", *args],
            cwd=cwd or self.work, env=self.env, capture_output=True,
            text=True, encoding="utf-8", errors="replace", timeout=30,
        )
        if check and result.returncode:
            self.fail(f"git {args!r} failed:\n{result.stdout}\n{result.stderr}")
        return result.stdout.strip() if check else result

    def run_release(self, *args, version=None, variables=None, success=True):
        environment = self.env.copy()
        if version is not None:
            environment["RELEASE_VERSION"] = version
        for name, value in (variables or {}).items():
            if value is None:
                environment.pop(name, None)
            else:
                environment[name] = value
        result = subprocess.run(
            [BASH, RELEASE_SCRIPT.as_posix(), *args], cwd=self.work,
            env=environment, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=60,
        )
        message = f"Release output:\n{result.stdout}\n{result.stderr}"
        if success:
            self.assertEqual(result.returncode, 0, message)
        else:
            self.assertNotEqual(result.returncode, 0, message)
        return result

    def calls(self, operation=None):
        paths = sorted(self.state.glob("call-*"), key=lambda path: int(path.name[5:]))
        calls = [path.read_bytes().decode("utf-8").rstrip("\0").split("\0")
                 for path in paths]
        return [call for call in calls if operation is None or call[0] == operation]

    def refs(self, cwd=None, prefix="refs/"):
        return self.git("for-each-ref", "--format=%(refname) %(objectname)", prefix, cwd=cwd)

    def remote_tag(self, peel=False):
        suffix = "^{}" if peel else ""
        return self.git("rev-parse", f"refs/tags/{TAG}{suffix}", cwd=self.remote)

    def assert_no_tags(self):
        self.assertEqual(self.refs(prefix="refs/tags/"), "")
        self.assertEqual(self.refs(cwd=self.remote, prefix="refs/tags/"), "")

    def worktree_snapshot(self):
        return {
            "branch": self.git("symbolic-ref", "HEAD"),
            "head": self.git("rev-parse", "HEAD"),
            "status": self.git("status", "--porcelain=v1", "--untracked-files=all"),
            "index": (self.work / ".git" / "index").read_bytes(),
            "files": {
                path.relative_to(self.work).as_posix(): path.read_bytes()
                for path in self.work.rglob("*")
                if path.is_file() and ".git" not in path.relative_to(self.work).parts
            },
            "branches": self.refs(prefix="refs/heads/"),
        }

    def advance_main(self):
        (self.seed / "tracked.txt").write_text("Main advanced\n", encoding="utf-8")
        self.git("add", "tracked.txt", cwd=self.seed)
        self.git("commit", "-m", "Advance main", cwd=self.seed)
        self.git("push", "origin", "main", cwd=self.seed)
        return self.git("rev-parse", "HEAD", cwd=self.seed)

    def assert_release_creation(self, target):
        creates = self.calls("release")
        self.assertEqual(len(creates), 1)
        command = creates[0]
        self.assertEqual(command[:3], ["release", "create", TAG])
        for flag in ("--verify-tag", "--generate-notes"):
            self.assertIn(flag, command)
        for flag, value in (
            ("--repo", REPOSITORY), ("--title", "fw.webex v1.0.3"), ("--target", target)
        ):
            self.assertIn(flag, command)
            self.assertEqual(command[command.index(flag) + 1], value)
        queries = self.calls("api")
        self.assertTrue(queries)
        for command in queries:
            self.assertIn("--paginate", command)
            self.assertIn(f"repos/{REPOSITORY}/releases?per_page=100", command)
            self.assertIn("--jq", command)
            selector = command[command.index("--jq") + 1]
            self.assertIn("tag_name", selector)
            self.assertIn(TAG, selector)
            self.assertIn("html_url", selector)

    def test_new_release_publishes_only_annotated_tag_and_github_release(self):
        before = self.worktree_snapshot()
        remote_branches = self.refs(cwd=self.remote, prefix="refs/heads/")

        self.run_release(version="1.0.3")

        self.assertEqual(self.remote_tag(peel=True), self.main_commit)
        self.assertEqual(self.git("cat-file", "-t", f"refs/tags/{TAG}"), "tag")
        self.assertEqual(self.refs(cwd=self.remote, prefix="refs/heads/"), remote_branches)
        self.assertEqual(self.worktree_snapshot(), before)
        self.assertEqual(self.git("tag", "--list", cwd=self.remote), TAG)
        self.assert_release_creation(self.main_commit)
        self.assertEqual(self.calls()[0][0], "api")

    def test_prefixed_version_argument_and_explicit_main_are_accepted(self):
        self.run_release(TAG, "main")
        self.assertEqual(self.remote_tag(peel=True), self.main_commit)
        self.assert_release_creation(self.main_commit)

    def test_release_uses_fetched_main_and_preserves_dirty_feature(self):
        self.git("switch", "-c", "feature/independent-work")
        (self.work / "feature.txt").write_text("Feature commit\n", encoding="utf-8")
        self.git("add", "feature.txt")
        self.git("commit", "-m", "Independent feature")
        (self.work / "tracked.txt").write_text("Staged edit\n", encoding="utf-8")
        self.git("add", "tracked.txt")
        (self.work / "tracked.txt").write_text("Staged and unstaged edit\n", encoding="utf-8")
        (self.work / "untracked.txt").write_text("Local work\n", encoding="utf-8")
        (self.work / "CHANGELOG.md").write_text("User changelog edit\n", encoding="utf-8")
        before = self.worktree_snapshot()
        newest_main = self.advance_main()
        remote_branches = self.refs(cwd=self.remote, prefix="refs/heads/")

        self.run_release(version="1.0.3")

        self.assertEqual(self.remote_tag(peel=True), newest_main)
        self.assertNotEqual(newest_main, before["head"])
        self.assertEqual(self.worktree_snapshot(), before)
        self.assertEqual(self.refs(cwd=self.remote, prefix="refs/heads/"), remote_branches)
        self.assert_release_creation(newest_main)

    def test_repeated_release_is_noop_even_after_main_advances(self):
        self.run_release(version="1.0.3")
        tag_object = self.remote_tag()
        self.advance_main()
        before = self.worktree_snapshot()
        remote_refs = self.refs(cwd=self.remote)

        self.run_release(version="1.0.3")

        self.assertEqual(self.remote_tag(), tag_object)
        self.assertEqual(self.refs(cwd=self.remote), remote_refs)
        self.assertEqual(self.worktree_snapshot(), before)
        self.assert_release_creation(self.main_commit)

    def test_retry_after_release_failure_preserves_original_tag(self):
        (self.state / "fail-create").touch()
        self.run_release(version="1.0.3", success=False)
        tag_object = self.remote_tag()
        self.assertFalse((self.state / "release-exists").exists())
        self.advance_main()
        (self.state / "fail-create").unlink()

        self.run_release(version="1.0.3")

        self.assertEqual(self.remote_tag(), tag_object)
        self.assertEqual(self.remote_tag(peel=True), self.main_commit)
        creates = self.calls("release")
        self.assertEqual(len(creates), 2)
        for command in creates:
            self.assertEqual(command[command.index("--target") + 1], self.main_commit)
        self.assertTrue((self.state / "release-exists").exists())

    def test_api_failure_aborts_before_creating_or_pushing_tag(self):
        before = self.worktree_snapshot()
        (self.state / "fail-api").touch()

        self.run_release(version="1.0.3", success=False)

        self.assert_no_tags()
        self.assertEqual(self.calls("release"), [])
        self.assertEqual(self.worktree_snapshot(), before)

    def test_tag_outside_main_is_rejected(self):
        self.git("switch", "-c", "unmerged", cwd=self.seed)
        (self.seed / "unmerged.txt").write_text("Unmerged work\n", encoding="utf-8")
        self.git("add", ".", cwd=self.seed)
        self.git("commit", "-m", "Unmerged work", cwd=self.seed)
        self.git("tag", "-a", TAG, "-m", "Unmerged tag", cwd=self.seed)
        self.git("push", "origin", f"refs/tags/{TAG}", cwd=self.seed)
        remote_refs = self.refs(cwd=self.remote)
        before = self.worktree_snapshot()

        self.run_release(version="1.0.3", success=False)

        self.assertEqual(self.refs(cwd=self.remote), remote_refs)
        self.assertEqual(self.worktree_snapshot(), before)
        self.assertEqual(self.calls("release"), [])

    def test_existing_release_without_remote_tag_is_rejected(self):
        (self.state / "release-exists").touch()

        self.run_release(version="1.0.3", success=False)

        self.assert_no_tags()
        self.assertEqual(self.calls("release"), [])

    def test_existing_release_with_only_local_tag_is_rejected(self):
        self.git("tag", "-a", TAG, "-m", "Local unpublished tag")
        local_tags = self.refs(prefix="refs/tags/")
        (self.state / "release-exists").touch()

        self.run_release(version="1.0.3", success=False)

        self.assertEqual(self.refs(prefix="refs/tags/"), local_tags)
        self.assertEqual(self.refs(cwd=self.remote, prefix="refs/tags/"), "")
        self.assertEqual(self.calls("release"), [])

    def test_conflicting_local_and_remote_tags_are_never_overwritten(self):
        self.git("tag", "-a", TAG, "-m", "Local tag")
        local_tags = self.refs(prefix="refs/tags/")
        self.git("tag", "-a", TAG, "-m", "Different remote tag", cwd=self.seed)
        self.git("push", "origin", f"refs/tags/{TAG}", cwd=self.seed)
        remote_refs = self.refs(cwd=self.remote)

        self.run_release(version="1.0.3", success=False)

        self.assertEqual(self.refs(prefix="refs/tags/"), local_tags)
        self.assertEqual(self.refs(cwd=self.remote), remote_refs)
        self.assertEqual(self.calls("release"), [])

    def test_invalid_versions_are_rejected_without_publishing(self):
        for version in (
            "", "1", "1.0", "1.0.3.4", "v1.0.3", "01.0.3", "1.00.3", "1.0.03",
            "fw.webex-v01.0.3", "1.0.3-rc.1", "1.0.3+build", "-1.0.3", "1.0.3 ",
            "1.0.3\n", "1.0.*", "../1.0.3",
        ):
            with self.subTest(version=repr(version)):
                self.run_release(version=version, success=False)
                self.assert_no_tags()
        self.assertEqual(self.calls(), [])

    def test_missing_repository_is_rejected_without_publishing(self):
        self.run_release(version="1.0.3", variables={"GITHUB_REPOSITORY": None}, success=False)
        self.assert_no_tags()
        self.assertEqual(self.calls(), [])

    def test_non_main_base_is_rejected_from_argument_and_environment(self):
        self.run_release("1.0.3", "develop", success=False)
        self.run_release(version="1.0.3", variables={"RELEASE_BASE_BRANCH": "feature/work"}, success=False)
        self.assert_no_tags()
        self.assertEqual(self.calls(), [])


if __name__ == "__main__":
    unittest.main()
