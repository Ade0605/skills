<p align="center">
  <img src="banner.png" alt="Devil's Advocate" width="100%">
</p>

# devils-advocate

Claude's harshest critic. A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that critiques Claude's work with binary pass/fail evaluation — every criterion either passes or fails, no percentage scores, no wiggle room.

## Why

Claude writes code confidently. Too confidently. Left unchecked, it'll tell you everything looks wonderful right up until production catches fire. Inspired by [Confidently Wrong](https://brandon.cc/confidently-wrong).

A [devil's advocate](https://en.wikipedia.org/wiki/Devil%27s_advocate) argues against a position not because they believe the other side, but to surface the holes everyone else missed. This plugin gives Claude that role — the skeptical colleague who says "yeah, but what about..." instead of "LGTM."

Every failure demands `file:line` evidence for every place it occurs, a severity, and a fix suggestion. No hand-waving, no vibes-based reviews.

## What it catches

It'll flag you for reinventing bcrypt, missing authorization checks, duplicating a helper that already exists three directories away, writing plans where step 4 depends on step 7, N+1 queries in hot paths, and shipping without a rollback strategy. It knows when you're hand-rolling auth instead of using a battle-tested library, and it won't let you forget that "works on my machine" isn't a testing strategy.

It also catches **architectural drift** — when Claude bypasses an established API layer to hit a database directly, adds special-case conditionals instead of proper abstractions, or papers over a root cause with a band-aid fix. It mines your codebase for dominant patterns and enforces them, even if they're not documented.

And it's honest in both directions: when everything genuinely passes, the verdict is **READY TO SHIP** (code) or **APPROVED** (plans) — it's forbidden from manufacturing problems to appear thorough. "Do nothing" is a valid outcome.

It works on both code and plans — auto-detecting which criteria set to use based on what you're reviewing.

## Install

```
/plugin marketplace add brandonsimpson/devils-advocate
/plugin install devils-advocate@devils-advocate
```

<details>
<summary>Manual install</summary>

```bash
git clone https://github.com/brandonsimpson/devils-advocate.git
```

Single session — note the `/plugin` suffix; the plugin lives in the `plugin/` subdirectory, not the repo root:

```bash
claude --plugin-dir ./devils-advocate/plugin
```

Permanent — link the plugin into your skills directory and it loads every session as `devils-advocate@skills-dir`:

```bash
ln -s "$(pwd)/devils-advocate/plugin" ~/.claude/skills/devils-advocate
```

</details>

## Commands

| Slash command | Natural language |
|---|---|
| `/devils-advocate:critique` | "critique" or "critique this plan" |
| `/devils-advocate:log` | "show critique log" |

### `/devils-advocate:critique`

Binary pass/fail critique across every dimension that matters. Auto-detects whether you're reviewing code or a plan document.

**Independence gate:** When critiquing work Claude wrote in the same conversation, it automatically dispatches an independent subagent to avoid author bias. The reviewer reads the skill itself and gets the artifact, the codebase, and the task as you stated it. It never sees the author's reasoning.

**Code critique (20 criteria, 7 dimensions):**

- **Correctness** — Tests pass? Logic correct? Edge cases handled?
- **Security** — No hardcoded secrets, input validated, no injection vectors, auth enforced?
- **Quality** — No dead code, no placeholders, errors handled properly, no code smell?
- **Performance** — No N+1 queries, no O(n^2) in hot paths?
- **Consistency** — Types match, naming follows conventions, patterns followed?
- **Integration** — Imports resolve, tests exist, no regressions?
- **Architecture** — Established boundaries respected, no hacky shortcuts?

**Plan critique (22 criteria, 10 dimensions):**

- **Completeness** — Requirements covered, no placeholders, edge cases addressed?
- **Correctness** — APIs verified against docs, patterns match library usage?
- **Testability** — Specific tests per step, E2E verification strategy?
- **Security** — Secrets managed properly, input validated, auth designed?
- **Consistency** — Types consistent, naming follows conventions?
- **Simplicity** — No overengineering, no reinventing solved problems?
- **Dependencies** — Correct task ordering, all deps available?
- **Resilience** — Rollback plan exists, performance considered?
- **Integration** — Import paths valid, follows project patterns?
- **Architecture** — Established boundaries respected, no hacky shortcuts?

Every FAIL is tagged `[blocker]` (wrong behavior, a security or data-loss risk, a broken build, a violated requirement) or `[minor]` (naming, clarity, small smells; style rules stay minor even when your CLAUDE.md documents them). It lists every location the problem appears and comes with a `Fix:` that covers all of them. Example output:

```
DEVIL'S ADVOCATE CRITIQUE (Binary Eval)
═══════════════════════════════════════

Target: code changes for webhook handler

  Correctness:
    tests-pass ...... PASS
    logic-correct ... PASS
    edge-cases ...... FAIL [blocker] — No handling for empty payload at webhook.ts:45.
                      Fix: Add early return with 400 status for empty/malformed payloads.

  Security:
    no-secrets ...... PASS
    input-validated . FAIL [blocker] — String interpolation in buildQuery() at db.ts:23 and findUser() at db.ts:61.
                      Fix: Use the parameterized query builder in both.
    no-injection .... FAIL [blocker] — innerHTML used at dashboard.tsx:89.
                      Fix: Use textContent or a sanitization library.
    auth-enforced ... PASS

  ...

Result: 15/20 PASS — 5 failing (3 blocker, 2 minor)

Failing criteria with fixes:
1. [blocker] edge-cases: Add early return for empty payloads at webhook.ts:45
2. [blocker] input-validated: Use parameterized queries at db.ts:23 and db.ts:61
3. [blocker] no-injection: Replace innerHTML at dashboard.tsx:89
4. [minor] ...
```

When everything passes, it says so plainly instead of inventing nits. When only minor issues remain, it says so too (`VERDICT: MINOR FIXES ONLY`: fix and commit, no re-critique):

```
Result: 20/20 PASS

VERDICT: READY TO SHIP — No blockers. All 20 criteria pass. This work is clean.

Unverified:
• Did not test against the live payment API — recorded fixtures only
```

Every critique ends with an **Unverified** section — at least one thing it did *not* check. A reviewer that claims it verified everything is lying.

**Fewer rounds.** Most extra critique rounds come from partial fixes (a value corrected in one place but not the other) and from fixes that contradict the rest of the work, not from issues the first review missed. So the loop is built to avoid both:

- **The review sweeps completely.** It maps every requirement, checks every input and state for edge cases, and greps for other copies of each defect before reporting it.
- **The fix step is structured.** It fixes every cited location, propagates each correction to other copies of the same fact, checks new content against what was already there, runs the tests, and records a list of what changed.
- **Re-critiques start from the last result.** They get the previous critique and the change list, check the old FAILs first (marking any that survived `(recurring)`), review the changed regions for new contradictions, then do a fresh full pass.
- **Minor-only results skip the re-critique.** Only a blocker triggers another round.

Each critique authorizes exactly one commit: **fix → re-critique (blockers only) → commit**.

### `/devils-advocate:log`

Session history: total checks, pass rate trend, the worst check (ranked by blocker count), and a git SHA linking each check to a specific commit. Individual critiques are saved to `.devils-advocate/logs/` for later reference.

## Standards & Project Awareness

The critique skill automatically discovers your project's documented standards before evaluating:

- **`CLAUDE.md` / `AGENTS.md`** — Your conventions, required patterns, and constraints. Standards violations cause relevant criteria to FAIL.
- **ADR files** — Searched in `docs/adr/`, `docs/decisions/`, `adr/`, `decisions/`, `doc/architecture/decisions/`, and `**/ADR-*.md`
- **Existing patterns** — Utilities, helpers, and conventions already in your codebase that the critiqued code might be duplicating.
- **Architectural boundaries** — Barrel exports, API client modules, repository patterns, and service layers that indicate intentional boundaries. If 5+ instances in your codebase do something one way, that's the established pattern — violations fail even if undocumented.

## Session Log & Hooks

Every check is logged to `.devils-advocate/session.md` with a git SHA and its target, so you can correlate results with specific commits and a re-critique can find the check it follows up on. Full critique output is saved to individual files in `.devils-advocate/logs/`. Add `.devils-advocate/` to your `.gitignore`.

A pre-commit hook nudges you to run a critique before committing — the commit still proceeds, it's just a reminder. A plan-file hook suggests running `/devils-advocate:critique` when you write a plan file. Both hooks are configurable via `.devils-advocate/config.json`:

```json
{"hooks": {"pre-commit-warning": false, "plan-file-detect": false}}
```

## How It's Tested

The critic gets criticized too. The plugin ships with 200 deterministic checks (metadata, criteria completeness, hook behavior, output format, the round-reduction rules) plus 9 live-LLM evals. The evals feed planted-bug fixtures through the critique skill and assert that it catches them, tags them with the right severity, cites every location, and flags a missed fix as recurring, without manufacturing failures on clean work. On the eval suite's first run, it failed its own "clean" fixture; the model had found three real flaws in it. The fixtures got fixed, not the thresholds.

Release history: [CHANGELOG.md](CHANGELOG.md)

## License

MIT
