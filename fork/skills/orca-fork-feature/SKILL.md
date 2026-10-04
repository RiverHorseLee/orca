---
name: orca-fork-feature
description: Plan, implement, and verify custom features in the Orca fork that contains fork/README.md, keeping upstream changes minimal. Use for this fork's feature work and development preparation, not for general Orca usage or upstream synchronization.
---

# Orca Fork Feature Development

## Scope and starting point

- Resolve the active worktree root; use only that worktree for reads and edits. Confirm `fork/README.md` exists in the checkout or in the named local `develop` / `origin/develop` ref before applying this fork's branch convention.
- Read root `AGENTS.md` and `fork/DEVELOPMENT.md`. On pure main, use `git show develop:fork/DEVELOPMENT.md` (or the confirmed origin/develop ref) rather than copying fork files onto main. Preserve upstream rules; this skill does not authorize pushing, publishing, running paid/credentialed operations, or delegating to subagents.
- Inspect status, branch, remotes, and ongoing Git operations before changes. Do not auto-stash, reset, clean, or discard existing work.
- `main` mirrors upstream. Start feature/fix branches from `develop`, not `main`. Continue an existing feature branch for a continuation request; do not overwrite a similarly named branch. PRs target the fork's `develop`.
- If the user requests only a design, deliver the design without implementing the runtime feature.

## Plan before expanding the code surface

Search proportionately for existing components, services, provider contracts and extension points. When CPU is high, never start or continue `rg`; use targeted reads and `git ls-files` instead.

For substantial work, update or create a concrete plan under `fork/plans/` containing:

- User-visible behavior, non-goals and acceptance criteria.
- Existing implementation to reuse, and why other apparent extension points do not fit.
- New domain files and the small set of existing integration points; explain every added dependency or existing-file change.
- Data ownership, trust boundaries, failure/stale states, SSH/WSL/browser/mobile behavior and mixed-version handling.
- Tests, incremental milestones and how disabling/reverting the feature restores upstream behavior.

Prefer additive domain modules plus thin integration points. Do not duplicate a subsystem, add a generic plugin platform, or reformat unrelated files. A file-count budget is a review trigger, not a reason to combine unrelated concerns into one oversized file.

## Custom usage feature

For custom usage, percentage, quota, HTTP usage endpoints or Python adapters, read `fork/plans/custom-usage.md` first.

Keep the renderer presentation-only. The proposed boundary is external Python adapter → versioned JSON over loopback HTTP → desktop-local typed reader → small UI segment. Provider secrets, response mapping and quota computation remain outside Orca. Do not disguise account snapshots as Claude/Codex session usage or extend every hard-coded provider union.

This is a design until explicitly implemented. Recheck actual extension points before each milestone; if upstream gains a suitable stable extension, prefer it over the planned integration.

## Implementation and verification

- Reuse style-guide tokens and `components/ui/` primitives. Do not copy existing raw palette classes or computed class strings merely because adjacent legacy code uses them.
- Keep feature configuration disabled by default. No configuration must mean no requests, timers, credential reads or UI changes.
- Reuse existing lifecycle, IPC, runtime and process wrappers where appropriate. Do not add direct child-process spawning, shell interpolation or a local fallback for remote execution.
- Set `ORCA_BACKGROUND_LAUNCH=1` for every test and agent-launched app and run them in the background. Use `$electron` and Playwright CDP for hidden UI checks as required by root instructions; if that skill is unavailable, report the limitation instead of using computer-use or showing windows.
- Validate the relevant types/tests and changed-code quality; run `pnpm build` before claiming the feature builds. Respect specialized real-CLI checks and distinguish missing credentials from passing tests.
- On a feature branch, `ORCA_CODE_QUALITY_BASE=develop` checks the feature diff; on `develop`, use `main` or the actual integration base, not `develop` itself. Restore temporary environment overrides afterward.
- Install with the manifest-pinned package manager and `--frozen-lockfile`; a full build also requires the independent `mobile/` install. Do not change the manifest, lockfile or native patches merely to bypass an environment failure.

## Finish

Report the current branch, actual changes, verification commands and exit results, remaining risks and whether anything was committed/pushed. Update `fork/VALIDATION.md` for a milestone-level build. Separate a compiled build from UI validation, signed packaging, cross-platform verification and real-provider integration.
