# Custom Usage integration: 2026-10-12

## Branch history

- Starting feature / origin: `36e7b64519b572d82dffef5e5ff236a61f9896a2`. Local `develop` was advanced only after baseline validation to `811fa42af606a6707b739f2025cff46280736966`, containing the untouched upstream `main` tip `f8daed0d986a5f06d58f1299771c856e9cbe77b4` (718 upstream commits). See [baseline verification](2026-10-12-upstream.md).
- Created `sync/custom-usage-20261012-f8daed0d` from the feature tip, then merged develop with `git merge --no-ff --no-edit develop`. The real merge commit is `d5ccf1fc9840`; follow-up regression test commit is `b86a93b6fc6a`.
- Two textual conflicts: `StatusBarProviderSegment.tsx` and `StatusBarSurface.tsx`. Retained upstream's stable-width +N counter and status bar percentage unit semantics, plus the fork's extra Custom row, urgency, refresh and collapse handling. Extra hidden Custom count and providerCount now both contribute to +N; custom percentage participates in the density calculation. Adapted tests to the new providerCount contract and added a density regression.
- Upstream replaced `src/shared/child-process/run-process` with `@orca/process-host`; the custom runner and its test now use its documented process-spec export. No replacement process runner was written; no user script or credentials were copied to Git.

## Verification

- Root and independent mobile dependencies were installed with `--frozen-lockfile` during baseline validation. Node 24.12.0, pnpm 12.8.1, Bun 1.4.2 and existing Cargo 1.99.0; PATH was scoped to the commands.
- Fourteen focused files cover the Custom schema, IPC, configuration, lifecycle, service, settings, Status Bar roster/collapse/density/percentage and provider regression: final run **187 passed / 0 skipped**, exit 0. Set `ORCA_TEST_CUSTOM_USAGE_PYTHON` to the installed Python for this run. The earlier standalone real-Python runner test also passed all 12 cases; the repository's sample Python unittest passed 3 cases. No real Gateway HTTP request was made.
- `ORCA_CODE_QUALITY_BASE=main pnpm run check:code-quality:changed`: zero new issues in all seven groups across 43 files, exit 0. Before the merge was committed, running the same gate attempted to scan 718 upstream commits and hit `ENAMETOOLONG` on Windows; rerunning after the real merge commit passed. No gate was disabled.
- `pnpm build` passed: typecheck, process-host, relay, CLI, Electron, Web, Mobile Web and Windows native launcher. First build after merge found outdated imports; corrected them and repeated the full build successfully. After the extra density test, the full build passed again.
- Windows x64 NSIS installer built locally with `ORCA_LOCAL_BUILD_VERSION=9.0.3`, no tracked `package.json` edit, `--publish never`, and a private electron-builder config excluding `dist`. Installer: `dist/custom-usage-9.0.3/orca-custom-usage-9.0.3-setup.exe` (190.8 MiB), SHA-256 `5FE4604716748BB8A8B498DBC0EA31A953B6ADE7C561597D451B8FFF7A1C7AE1`. PE, packaged app, CLI and manifest report 9.0.3; package has zero nested dist files. Native node-pty, daemon entry and plugin resource checks passed. The installer is **unsigned**, and this local build does not bundle an orcad deployment template; do not claim full remote managed deployment parity without its release-template build.
- No installer was run and no user data, live agents, active terminals, paired mobile devices or workstation login was touched. The optional `$electron` skill is not present, so hidden CDP visual validation, real SSH/mobile, macOS/Linux and post-install survival are **not verified**. Test and application launch policy was `ORCA_BACKGROUND_LAUNCH=1`.

## Publication

Only local branches were advanced under this request; no push to origin or upstream, no release publication and no install. Git-private logs include `.git/fork-sync-20261012-feature-{final-tests,final-quality,final-build}.log` and `.git/fork-sync-20261012-win-package.log`. Private Gateway script `C:/Users/lijuntao/.orca/custom_usage_gateway.py` remains outside this repository.
