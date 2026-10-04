---
name: orca-fork-sync
description: Safely synchronize upstream changes into the Orca fork containing fork/README.md, preserving a pure main and validating merges before advancing develop. Use for upstream checks and synchronization, not ordinary feature implementation or release publishing.
---

# Orca Fork Upstream Synchronization

## Establish scope

Read root `AGENTS.md`, `fork/README.md` and the synchronization/verification sections of `fork/DEVELOPMENT.md` in the active worktree. Pure main deliberately has no fork files: read them with `git show develop:fork/README.md` and `git show develop:fork/DEVELOPMENT.md`, or the confirmed origin/develop ref. If neither contains the marker, report an unconfigured fork; never copy these files onto main. This skill is not permission to push, publish, delete branches, force-update refs or run credentialed external tests. A request to inspect updates is read-only apart from the necessary fetch; an explicit synchronization request may advance local branches.

1. Check `git status --short --branch`, `git branch -vv`, `git remote -v`, `git worktree list --porcelain`, and operation markers resolved with `git rev-parse --git-path`.
2. Stop before mutation for a dirty tree, an active merge/rebase/cherry-pick, an unexpected remote, or a branch checked out in a different worktree. Never edit a different worktree or stash user work automatically.
3. Record the starting branch and main/develop SHAs. `origin` should be the user's fork and `upstream` its confirmed source. Missing remote configuration requires confirmation of its target, not guessing.
4. Do not enumerate all refs or fetch unrelated branches/tags. Do not run `rg` under high CPU load. Network/auth failures stop this attempt; do not launch interactive credential windows.

## Fetch and inspect

Fetch only `origin`'s main/develop and `upstream`'s main with `--no-tags`; check that remote develop exists before requesting it on a new clone. Read bounded logs and a diff summary for the selected range.

Before changing main, verify both local main and origin/main are ancestors of upstream/main with `git merge-base --is-ancestor`. Exit code 1 means a violated mirror invariant; other nonzero codes are errors, not evidence of ancestry. Stop and report instead of rebasing, hard-resetting or force-pushing.

For develop versus origin/develop: equal or local-ahead is safe to continue; remote-only-ahead may be fast-forwarded; divergence needs explicit resolution. Record dependency, native, launch-policy, protocol and test changes that affect validation.

If main is already current but develop is behind it, still perform integration. If both are current and there is no new work, report a no-op and do not manufacture commits.

## Local synchronization

- Switch to main and use `git merge --ff-only upstream/main`. Main must equal the fetched upstream tip afterward.
- Bring develop forward only if required and safe, then create a fresh `sync/upstream-<date>` branch from it. Avoid colliding names; retain previous attempts for diagnosis.
- Merge main with a real merge (`git merge --no-ff --no-edit main`); never squash or cherry-pick a batch of upstream commits.
- Resolve conflicts by intended behavior, preserving fork features and upstream fixes. Do not apply blanket ours/theirs, delete tests, loosen quality gates or regenerate lockfiles blindly. If intent is ambiguous, leave develop unchanged and ask a specific question.
- The pure main mirror may move before verification; develop must not advance to unverified integration code.

## Validate before integrating

Follow the manifest's pinned toolchain. Set `ORCA_BACKGROUND_LAUNCH=1` and run all tests/apps in the background. Keep logs in an ignored local path.

Use frozen-lockfile installation when dependencies changed, for both the root and the independent `mobile/` workspace required by the full build. Run relevant regression tests, the changed-quality gate and `pnpm build`. Use `main` as the quality baseline to check the full retained fork delta. Read feature plans for fork-specific regression cases; once custom usage exists, cover schema validation, offline/stale behavior and the disabled-feature path. UI changes require hidden CDP checks, not focused windows. Apply root specialized tests to their affected areas.

Do not claim success because Git merged cleanly. Record all failures and unverified requirements. Leave a failing integration on its sync branch, with develop at its pre-integration SHA. Do not retry destructive fixes, remove native patches or change dependencies just to turn the build green.

Commit the verification record on the sync branch; do not carry uncommitted evidence into develop. When validation passes and local integration is authorized, verify develop has not moved, then fast-forward develop to the tested sync branch. If it moved, stop and re-integrate/retest rather than forcing it. Keep the synchronization merge commit intact.

## Publication and reporting

Push to origin only when the user authorized remote updates. Never push to upstream. Use explicit branch names, not `--all`, `--mirror`, `--force` or `--force-with-lease`. A rejected push stops publication; fetch and report the changed remote state rather than retrying blindly.

Update `fork/VALIDATION.md` on the integration branch for material syncs. Report the fetched upstream SHA, before/after main and develop, integration branch, conflicts, commands/results, current branch and local-versus-remote status. Do not change the repository default branch, release workflows or branch protections as part of a sync.
