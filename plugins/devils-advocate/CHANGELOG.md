# Changelog

All notable changes to the devils-advocate plugin. Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/). Older releases (pre-3.0) predate this file — see git history.

## [3.4.0] — 2026-09-25

### Added

- **Fewer critique rounds.** Session logs showed that most extra rounds came from partial fixes (a fact corrected in one place but left stale elsewhere) and from fix side effects (new content contradicting existing content), not from issues the first review missed.
  - Every FAIL now cites every location the defect appears.
  - Open-ended criteria (`req-coverage`, `logic-correct`, `edge-cases`) are swept exhaustively, and the reviewer greps for other copies of each defect.
  - A new **Applying Fixes** procedure: fix → propagate → reconcile → verify → record a change list.
  - Re-critiques receive the previous log (`PREVIOUS`) and the change list (`CHANGES`). They check prior FAILs first (marking survivors `(recurring)`), then the changed regions, then run a fresh full pass.
- **Severity tags.** Every FAIL is tagged `[blocker]` or `[minor]` after the binary call. Style and naming rules stay minor even when a standards file documents them. Minor-only results get `VERDICT: MINOR FIXES ONLY` and skip the re-critique.
- Session entries record `Target:` (so a re-critique can find its previous check) and keep `(recurring)` on the Failing line. The log skill ranks the worst check by blocker count and surfaces `(recurring)` criteria.
- New deterministic checks (200 total across both suites) guarding the round-reduction rules, the session entry format, and the new dispatch slots. Drift guards now also tie the README's deterministic total and the README and plugin/CLAUDE.md eval counts to the real numbers.
- Three new evals (9 total): repeated injection must cite both locations, a re-critique must flag an unfixed sibling as recurring, and a minor-only change must get the minor-only verdict. The planted-bug evals also assert `[blocker]` tags.

### Changed

- **Dispatch hands the subagent the whole skill.** The subagent now reads and follows `SKILL.md` itself (skipping Step 0). The old template embedded only the criteria and log steps, so the reviewer never received the output format, the Unverified requirement, the scope rules, the context gate, or the anti-manufacturing rule. The evals missed this because they only exercise the inline path.
- **The reviewer gets the task.** A new `TASK` slot carries the user's intent (not the author's reasoning), which `logic-correct` and `req-coverage` need.
- **The context gate gathers context before refusing.** It used to STOP whenever files hadn't been read yet. It now outputs CONTEXT INSUFFICIENT only when tools can't obtain what's missing.
- **Unverifiable criteria** are marked PASS `(unverified)` and listed under Unverified instead of FAILed, since a FAIL needs evidence of a defect.
- **`tests-pass` and `no-regressions` no longer overlap.** `no-regressions` now covers broken existing contracts (APIs, signatures, config, output formats).
- Plan criteria are stack-neutral (dropped "Zod"). `api-verified` accepts installed source and type definitions as evidence.
- README documents severity tags, the minor-only verdict, and the round-reduction loop. Its example output uses the current format, and the check/eval counts are current.
- Prompting refreshed for current models: dropped "think step by step", explained the reasons behind rules instead of shouting them, and gave the code-mode target a default (uncommitted changes, otherwise HEAD).

### Fixed

- A grep that matched nothing inside a `$(...)` assignment silently aborted the suites under `set -euo pipefail`: no FAIL line, no summary, and the remaining checks skipped. The `:-none`, `:-0`, and "not found" fallbacks were unreachable. All seven such substitutions are guarded now (the count and dimension guards, `eval.sh`'s result parsing, and the hook counters), so a missing value prints a real FAIL. Found by independent critique check #18.
- v3.3.1's drift guards only covered SKILL.md — README.md and plugin/CLAUDE.md, two of the three files the dimension bug actually shipped in, were unguarded. Found by the plugin's own independent critique (check #15, `tests-exist` FAIL). Four new checks verify the dimension/criteria counts stated in both files against the headers counted from SKILL.md. Guard verified by seeded regression: flipping README back to "8 dimensions" fails the suite.

## [3.3.1] — 2026-06-11

### Fixed

- **Code criteria span 7 dimensions, not 8.** The wrong count shipped in README.md, SKILL.md, and plugin/CLAUDE.md since v3.2.0 (whose release notes, ironically, claimed to fix an off-by-one in the *plan* count). Four new consistency checks now count the actual dimension headers in both criteria blocks and verify the prose labels match (consistency suite at 38 checks; 165 deterministic total).

### Changed

- README refresh: architecture-drift detection folded into the main feature prose (was a stale "New in v3.2" callout), added an all-pass verdict example, the fix → re-critique → commit loop, a "How It's Tested" section, and a CHANGELOG link.

## [3.3.0] — 2026-06-11

### Changed

- **Dispatch template is now self-contained.** The independence-gate subagent prompt includes the full session-log instructions (find the next check number, append-preserving format, SHA + timestamp) — previously the subagent never saw Step 5 and could write a malformed log.
- **No more hardcoded `model: "opus"` in the dispatch.** The subagent inherits the session's model, so the gate works on every plan and survives model generations.
- **Verification guidance is stack-agnostic.** "npm list, tsc --noEmit" replaced with "run the project's own test/build/typecheck commands."
- **Chain-of-thought applies to inline critiques too**, not just dispatched ones.

### Added

- **Fix → re-critique → commit loop.** When criteria FAIL, the critique now ends by offering to fix them and re-run — each critique authorizes exactly one commit, so the loop closes itself.
- **`--quiet` / `-q` flag** on both shell suites: print only failures and the summary. Saves a few thousand tokens every time an agent runs them.
- **Code-mode evals.** `eval.sh` now runs 6 evals (3 plan + 3 code): planted TODO stubs, planted SQL concatenation, and clean-work calibration in both modes.
- 7 new deterministic checks (suite now at 127): dispatch self-containment, no pinned model, fix-recheck rule, code fixtures present, quiet-mode behavior.

### Fixed

- The "clean plan" eval fixture wasn't clean — the eval suite itself caught a broken ESM `package.json` named import, a self-contradicting test snippet, and a missing integration-verification step. The fixture (and its code-mode sibling) now survive an honest 22-criteria review.

## [3.2.1] — 2026-06-10

### Fixed

- **plan-file-detect hook output was silently ignored by Claude Code.** The hook emitted a bare top-level `additionalContext` field; Claude Code only consumes the nested `hookSpecificOutput.additionalContext` shape. The "suggests critique when you write a plan file" feature now actually works.
- **Test scripts died on bash ≥ 4.1.** `((VAR++))` returns exit status 1 when the counter is 0, which kills the script under `set -e` on Linux and CI runners (macOS bash 3.2 masks the bug). All counters now use `VAR=$((VAR+1))`.
- **README manual install instructions were broken.** `--plugin-dir` now points at the `plugin/` subdirectory (where the manifest actually lives), and the nonexistent `settings.json` `"plugins"` key was replaced with the supported skills-directory symlink.
- Corrupted U+FFFD characters in the log skill's output template.
- Plugin keywords updated (`confidence`/`scoring` were leftovers from the pre-3.0 percentage-scoring era).

### Added

- **All-pass verdicts.** A clean critique now ends with an explicit verdict — `READY TO SHIP` for code, `APPROVED` for plans — plus a rule against manufacturing problems to appear thorough.
- **Chain-of-thought dispatch.** The independence-gate subagent is instructed to think step by step before marking each criterion PASS or FAIL.
- **LLM eval suite** (`plugin/scripts/eval.sh`): live `claude -p` evals that feed planted fixtures through the critique skill and assert it catches the planted bugs (TODO placeholder, SQL interpolation) without manufacturing failures on a clean plan.
- Hook-output schema test: `test-plugin.sh` now parses hook stdout and asserts the Claude Code-consumable `hookSpecificOutput` shape. Test suite now at 120 checks, up from 112 in v3.2.0.

## [3.2.0] — 2026-04-11

### Added

- **Architecture dimension** in both criteria sets: `boundaries-respected` (service layers, API boundaries, module interfaces) and `no-hacky-shortcuts` (symptom-fixing, special-case conditionals, bypassing existing systems).
- `no-code-smell` criterion (god classes, feature envy, leaky abstractions).
- Enhanced standards discovery: dominant-pattern mining (5+ instances = established pattern, enforced even if undocumented) and boundary marker detection.
- Code criteria 17 → 20; plan criteria 19 → 22.

## [3.1.0] — 2026-04-08

### Added

- **Independence gate.** Critiquing work written in the same conversation dispatches an independent subagent — the reviewer sees only the artifact and codebase, never the author's reasoning. Falls back to inline critique with a bias warning if the Agent tool is unavailable.

## [3.0.0] — 2026-04-04

### Changed

- **Binary pass/fail evaluation replaces 0-100 scoring** (breaking). Every criterion is PASS or FAIL with `file:line` evidence and a `Fix:` suggestion — no percentage scores.
- Four skills (`critique`, `critique-plan`, `pre`, `second-opinion`) consolidated into a single `critique` skill with code/plan auto-detection.
