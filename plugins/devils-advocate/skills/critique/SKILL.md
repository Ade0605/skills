---
name: critique
description: Adversarial binary critique of code or plans.
---

# Devil's Advocate Critique

You are running an **adversarial binary critique**. Every criterion either passes or fails — no percentage scores, no partial credit. The point is to find the real flaws before they ship, and to say plainly when there are none.

## Target Detection

Determine whether you are critiquing **code** or a **plan** from the conversation:
- The user points at a plan/design document, or you just wrote one → **plan critique** (22 criteria)
- You just wrote code, or the user asks you to critique code changes → **code critique** (20 criteria)
- If it's genuinely ambiguous, ask the user

For a code critique with no explicit target, the target is the uncommitted changes (`git diff HEAD` plus untracked files). If the working tree is clean, it is the most recent commit (`git show HEAD`).

## Scope-Bounded Critique

Critique only what was requested. Out-of-scope features are not failures. If a criterion doesn't apply to the target (e.g., `no-injection` for code that takes no external input), mark it PASS with a one-line note saying why — don't skip it, so the count stays comparable across checks.

## Process

### Step 0: Independence Gate

**If you wrote or contributed to the target in this conversation, dispatch an independent subagent to do the critique.** Same-context critique has author bias: the author fills gaps from memory and rationalizes their own decisions. A fresh reviewer sees only the artifact and the codebase.

Fill in the slots and dispatch:

- `SKILL_PATH` — absolute path to this file: the "Base directory for this skill" shown when this skill loaded, plus `/SKILL.md`
- `TARGET` — the plan file path, or for code the exact scope (file list, or the git range such as "uncommitted changes vs HEAD")
- `TASK` — what the user asked for and any requirements or constraints they stated, in their words where possible. State intent only; leave out your own reasoning or justifications for the implementation — the reviewer should judge the work on its own.
- `PREVIOUS` — for a re-critique after fixes, the path of the previous check's log file (`.devils-advocate/logs/check-…`); otherwise `none`
- `CHANGES` — for a re-critique, the change list you kept while applying fixes (see Applying Fixes); otherwise `none`

```
Agent({
  description: "Independent DA critique",
  prompt: `You are an independent devil's advocate reviewer. You did not write the work below.

Read SKILL_PATH and follow it as the reviewer: skip Step 0 (you are the independent reviewer), then run Step 0b through Step 5 and produce the Output Format exactly as that file specifies, including the session log writes.

Target: TARGET
Mode: code | plan
Task the work was meant to accomplish: TASK
Previous critique: PREVIOUS
Changes made since the previous critique: CHANGES

Verify claims against the actual codebase with Read, Grep, Glob, and Bash. Run the project's own test/build/typecheck commands (find them in the package manifest, Makefile, or CLAUDE.md; prefer quiet/summary flags). Return the full formatted critique as your final message.`
})
```

Do not pin a model in the dispatch — let the subagent inherit the session's model.

When the subagent returns, show its critique to the user unedited. The subagent has already written the session log and marker, so don't run Steps 0b–5 yourself. If anything failed, offer fixes per the Rules; if the user accepts, follow Applying Fixes.

**Run inline (no subagent)** only when critiquing work you did not write in this conversation — someone else's PR, existing code, a plan the user brought in.

**Fallback:** If the Agent tool is unavailable or dispatch fails, critique inline and put this line at the top of the output: `WARNING: Self-critique — author bias may be present.`

### Step 0b: Context Gate

Before evaluating, make sure you can actually judge the work:
1. **Read the target.** If you haven't read the relevant files or diff yet, read them now.
2. **Know the task.** You need to be able to restate what the work was supposed to do. Without that, `logic-correct` and `req-coverage` can't be judged.
3. **Know the surroundings.** Explore enough of the repo to see how the target connects to the code around it.
4. **Confirm there is something to critique.** If the conversation produced no code or plan, say so.

Gathering missing context is your job — use your tools first. Output **CONTEXT INSUFFICIENT** only when something needed can't be obtained that way (the target can't be located, the task intent is unknown and not inferable, the referenced repo isn't available):
```
CONTEXT INSUFFICIENT
═══════════════════════════════════════
Cannot provide a meaningful critique. Missing:
• [what's missing]
• [what's needed]

Action required:
1. [specific step]
2. [specific step]
```

Don't produce a scored result without the context to back it. A confident-looking critique built on guesses is worse than none.

### Step 1: Discover project standards

Find the documented standards, architectural decisions, and established patterns the work should follow:

1. **Standards files** — Read `CLAUDE.md` and `AGENTS.md` in the project root. Note the conventions, required patterns, and constraints they define.
2. **ADR files** — Glob for architectural decision records: `docs/adr/*.md`, `docs/decisions/*.md`, `adr/*.md`, `decisions/*.md`, `doc/architecture/decisions/*.md`, `**/ADR-*.md`. Read any that exist.
3. **Existing patterns** *(code mode only)* — Grep for utilities, helpers, or conventions similar to what the target implements, to catch duplication of something that already exists.
4. **Architectural domain** — Identify which layer, module, or service the change touches and which boundaries surround it (API layers, service interfaces, module exports).
5. **Dominant patterns** — Find 3-5 examples of the same category of operation elsewhere (DB access, API calls, event handling, etc.). If 5+ instances do it one way, that is the established pattern, and violating it fails even if it's undocumented — code is the source of truth for convention.
6. **Boundary markers** — Look for barrel exports (`index.ts`/`index.js`), API client modules, repositories, service layers, or interface files that mark intentional boundaries.

Standards files with no actionable conventions count as no standards. Standards violations fail the relevant criterion.

### Step 2: Identify the target

State what is being critiqued and whether this is a code or plan critique.

This is a **re-critique** if a previous critique was provided (`PREVIOUS`), or if the latest entry in `.devils-advocate/session.md` has the same Target and had FAILs. In that case, read the previous log file before Step 3.

### Step 3: Gather evidence

Collect concrete evidence before evaluating:
- Read the code or plan in full, not just the parts that look risky
- **Code mode:** find and run the tests; check for hardcoded secrets, `eval()`, unsanitized input, SQL string concatenation, `innerHTML`, and command-injection vectors; check dependency manifests
- **Plan mode:** confirm referenced files, packages, and APIs exist; check that task ordering respects dependencies
- Record file paths and line numbers as you go

**Sweep the open-ended criteria completely.** These criteria otherwise turn up new findings every round, because each pass samples different instances:
- **Requirements** (`req-coverage`, `logic-correct`): list every requirement in the task and every claim the work makes about itself, then locate where each one is satisfied. A requirement with no home fails.
- **Edge cases** (`edge-cases`): for each external input and each state change, check empty or missing values, boundary and maximum values, malformed input, repeated or concurrent calls, and failure of each dependency it calls.
- **Repeated facts** (any criterion): when you find a defect, grep the target for every other occurrence of the same value, name, claim, or pattern before writing it up. Facts stated in several places (a version, price, port, limit, count, or type name) are where partial fixes hide.

**Re-critique checks.** On a re-critique, do these before the normal evaluation:
1. **Prior FAILs:** for each FAIL in the previous log, check every location it cited and search for other occurrences. Still present anywhere → FAIL again, marked `(recurring)`.
2. **Fix side effects:** review every region listed in `CHANGES` (or, without a change list, the regions the previous FAILs pointed at). Look for new contradictions between what was added and what was already there: new numbers, sections, or functions that disagree with existing ones, and tests the fix should have updated.
3. **Full pass:** then evaluate every criterion from scratch. Previous PASSes are not carried forward.

### Step 4: Evaluate against criteria

Evaluate every criterion in the set. Each gets one of:
- **PASS** — satisfied, with brief evidence (what you checked, not "looks fine")
- **FAIL** — violated, with `file:line` for **every** location the defect appears (not just the first one found) and a **Fix:** line that covers all of them

A FAIL without a fix isn't actionable, so every FAIL carries one. A fix that names only one of several locations produces a partial fix and a regression next round, so list them all.

**Tag every FAIL with a severity.** Decide PASS/FAIL first; severity never turns a FAIL into a PASS.
- **`[blocker]`** — would cause wrong behavior, a security or data-loss risk, a failing build or test, a plan step that can't be executed as written, or a violation of an explicit requirement or of a documented standard that governs behavior, security, or contracts
- **`[minor]`** — everything else: naming, clarity, small smells, inconsistencies that don't change behavior. Style and naming conventions are minor even when a standards file documents them.

When unsure, ask whether shipping it as-is would cause a bug, an incident, or rework. Yes → blocker.

**Couldn't verify?** If you can't check a criterion (no Bash to run tests, docs unreachable), don't FAIL it — a FAIL needs evidence of a defect. Mark it PASS with `(unverified)`, judge it from what you can read, and list it under Unverified.

#### Code Criteria (20 criteria, 7 dimensions)

```
Correctness:
  tests-pass        — Does the project's test suite pass? Run it; don't assume.
  logic-correct     — Does the code do what the task requires?
  edge-cases        — Are boundary conditions (empty, null, max, concurrent) handled?

Security:
  no-secrets        — No hardcoded secrets, keys, or tokens?
  input-validated   — Is external input validated before use?
  no-injection      — No SQL injection, XSS, or command injection vectors?
  auth-enforced     — Are authorization checks in place for protected operations?

Quality:
  no-dead-code      — No unused imports, unreachable code, or commented-out blocks?
  no-placeholders   — No TODO/FIXME/stub standing in for work the task requires?
  error-handling    — Are errors handled or propagated, never silently swallowed?
  no-code-smell     — No god classes, feature envy, leaky abstractions, inappropriate intimacy, or data clumps?

Performance:
  no-obvious-perf   — No N+1 queries, O(n²) in hot paths, or unnecessary allocations?

Consistency:
  types-consistent  — Do types match across the change?
  naming-matches    — Do names follow project conventions?
  patterns-followed — Does the code follow established patterns in the codebase?

Integration:
  imports-correct   — Do all imports resolve to real files/packages?
  tests-exist       — Does new behavior have tests that would fail if it broke?
  no-regressions    — Are existing contracts intact (public APIs, signatures, config, output formats, callers) unless the task changes them?

Architecture:
  boundaries-respected — Does the code respect established architectural boundaries (service layers, API boundaries, module interfaces)? If a dominant pattern exists and this code bypasses it, FAIL.
  no-hacky-shortcuts   — Does the code solve the actual problem? FAIL if: symptom-fixing instead of root cause, special-case conditionals instead of proper abstractions, bypassing existing systems instead of extending them, duplicating code instead of extracting, string manipulation instead of proper parsing, or swallowing exceptions.
```

#### Plan Criteria (22 criteria, 10 dimensions)

```
Completeness:
  req-coverage       — Does the plan address every requirement of the task?
  no-placeholders    — Are there TODO/FIXME/stub/placeholder items standing in for real steps?
  edge-cases         — Does the plan handle error states, empty inputs, and boundary conditions?

Correctness:
  api-verified       — Are third-party APIs checked against the installed source, type definitions, or official docs (not assumed)?
  patterns-correct   — Do code patterns match the library's documented usage?

Testability:
  tests-per-step     — Does each task include specific tests (not just "add tests")?
  verification       — Is there an end-to-end or integration verification strategy?

Security:
  no-secrets         — Are secrets handled via env vars or a secret store, never hardcoded?
  input-validated    — Is all external input validated (schema validation, parameterized queries)?
  auth-designed      — Does the plan address authorization for protected operations?

Consistency:
  types-consistent   — Are type definitions consistent across files and packages?
  naming-matches     — Do names follow the project's conventions?

Simplicity:
  no-overengineering — Does the plan do only what's needed (no YAGNI violations)?
  no-reinvention     — Does the plan use established libraries for solved problems?

Dependencies:
  correct-order      — Are tasks ordered so no step depends on a later one?
  deps-available     — Do all referenced dependencies exist (packages published, APIs reachable)?

Resilience:
  rollback-plan      — Can the changes be reversed if something goes wrong?
  perf-considered    — Does the plan account for performance at expected scale?

Integration:
  imports-correct    — Do import paths reference files/packages that actually exist?
  follows-patterns   — Does the plan follow the project's established patterns?

Architecture:
  boundaries-respected — Does the plan respect established architectural boundaries? If it proposes bypassing a dominant pattern (e.g., direct DB access when an API layer exists), FAIL.
  no-hacky-shortcuts   — Does the plan solve the actual problem? FAIL if: band-aid fixes, workarounds that skip root cause, special-case handling instead of proper abstractions, or bypassing existing systems instead of extending them.
```

### Step 5: Write the session log entry

Get the commit SHA with `git rev-parse --short HEAD` and the timestamp with `date +"%Y-%m-%d %H:%M"`, and use that one timestamp for both files below.

Read `.devils-advocate/session.md` if it exists; N is one more than its highest check number (1 if the file is new). Write the file back with all existing content preserved and this entry appended, creating the directory and file if they don't exist:

   ```markdown
   ## Check #N — Critique | YYYY-MM-DD HH:MM | <git-sha>
   - **Result:** X/Y PASS
   - **Target:** [the Target line from the output]
   - **Failing:** [comma-separated failing criteria with severity and any `(recurring)` marker, e.g. "input-validated [blocker] (recurring), naming-matches [minor]", or "none"]
   - **Summary:** [1-2 sentence summary]
   ```

Then also write the full formatted critique (the complete Output Format block) to `.devils-advocate/logs/check-{N}-critique-{YYYY-MM-DD}-{HHMM}.md` with the same N and timestamp. Create the `logs/` directory if it doesn't exist.

Finally run `touch .devils-advocate/.commit-reviewed`. The pre-commit hook consumes this marker and skips its "no critique found" warning on the next `git commit`.

## Output Format

```
DEVIL'S ADVOCATE CRITIQUE (Binary Eval)
═══════════════════════════════════════

Target: [plan filename or "code changes for <task>"]
Previous: [re-critique only: "Check #N — X of Y prior FAILs fixed, Z recurring"]

  Correctness:
    tests-pass ...... PASS
    logic-correct ... FAIL [blocker] — [specific issue at file:line, file:line, ...]
                      Fix: [actionable fix covering every location]
    edge-cases ...... PASS

  Security:
    no-secrets ...... PASS
    input-validated . FAIL [blocker] (recurring) — String interpolation in buildQuery() at db.ts:45 and searchOrders() at db.ts:88.
                      Fix: Use the parameterized query builder in both.
    no-injection .... PASS
    auth-enforced ... PASS

  Architecture:
    boundaries-respected .. PASS
    no-hacky-shortcuts .... PASS

  [... remaining dimensions ...]

Result: 17/20 PASS — 3 failing (2 blocker, 1 minor)

Failing criteria with fixes:
1. [blocker] logic-correct: [specific fix with every file:line]
2. [blocker] input-validated: [specific fix with every file:line]
3. [minor] [...]

Unverified:
• [what you did NOT verify — at least one item]
• [e.g., "Did not run the integration suite (needs a live database)"]
```

**When every FAIL is minor**, add this line after the "Failing criteria" block:
```
VERDICT: MINOR FIXES ONLY — No blockers. Apply the fixes above and commit; no re-critique needed.
```

**When all criteria pass**, keep the header and every per-criterion line, and replace the Result line and "Failing criteria" block with the verdict:

Code critique (20 criteria):
```
Result: 20/20 PASS

VERDICT: READY TO SHIP — No blockers. All 20 criteria pass. This work is clean.

Unverified:
• [what you did NOT verify — at least one item]
```

Plan critique (22 criteria):
```
Result: 22/22 PASS

VERDICT: APPROVED — No blockers. All 22 criteria pass. This plan is ready to execute.

Unverified:
• [what you did NOT verify — at least one item]
```

## Applying Fixes

When the user accepts the offer to fix, fix the whole class of problem, not just the cited line. Most extra critique rounds come from partial fixes and from fixes that contradict the rest of the work.

1. **Fix every cited location.**
2. **Propagate.** For each fix, grep the target and closely related files for other copies of the fact, value, name, or pattern you just corrected, and update them too.
3. **Reconcile.** Reread each region you changed alongside the rest of the document or module. Anything you added (a section, a number, a function, a test) must agree with what was already there.
4. **Verify.** For code, run the tests and typecheck.
5. **Record the change list** as you go, one line per change: `file:line — what changed`. Record facts only, no justifications; this becomes `CHANGES` for the re-critique.
6. **Decide on a re-critique.** If any fixed FAIL was a `[blocker]`, re-run the critique with `PREVIOUS` and `CHANGES` filled in. If they were all `[minor]`, tell the user the fixes are applied and the work is ready to commit without another round.

## Rules

- Be genuinely critical, not performatively critical. Anchor each criticism in a specific, concrete defect, not "could be better."
- Every FAIL cites `file:line` evidence for every location, carries a `[blocker]` or `[minor]` tag, and includes a `Fix:`. Every PASS carries brief evidence.
- If you discover a genuine flaw mid-assessment, say so plainly, even if it contradicts an earlier PASS.
- **If all criteria pass, emit the verdict — READY TO SHIP for code, APPROVED for plans. Do not manufacture problems to appear thorough; "do nothing" is a valid and correct outcome.**
- **If any criteria FAIL, end by offering to fix them (per Applying Fixes) and re-run the critique after the fixes when any blocker failed.** Fix → re-critique → commit is the intended loop for blockers; minor-only results go straight from fix to commit. Each critique covers exactly one commit.
- Always write the session log, even when every criterion passes.
- The Unverified section is required and lists at least one real item. No review checks everything, and naming the gaps tells the reader where residual risk lives.
