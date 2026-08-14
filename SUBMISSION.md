# Submission

## What did you investigate first, and why?

I read every file in `src/` plus the test and CI setup before touching anything,
because the README hints the starter "works for a narrow happy path" — meaning
the bugs are in the seams, not in any one file. That pass surfaced three
contract-level breaks I prioritized above everything else:

1. **The MCP tool was dead on arrival**: the schema declared `repo_path` but the
   handler read `input.repoPath`, so every call ran with an undefined repository
   path (hidden by an `input: any` cast).
2. **A failing validation crashed the whole review**: `runValidation` rejected on
   any non-zero exit, so the `"failed"` status in `types.ts` was unreachable —
   the tool could not report the one thing it exists to report.
3. **The CLI split `--repo` paths on spaces** and kept only the first word.

I verified each by reading the code path end to end (and later locked each with
a regression test) rather than trusting first impressions.

## What did you choose to implement or fix?

Smallest diff that fixes real defects, each with a test:

- **MCP contract** (`src/mcp-server.ts`): one consistent camelCase contract
  (`repositoryPath`, `baseRef`, `validationCommands`) with `.describe()` on every
  param for agent discoverability; dropped `input: any` for inferred types;
  errors now come back as MCP tool errors instead of crashing the server.
  Extracted `createServer()` so a real in-memory client↔server test
  (`test/mcp.test.ts`) pins the contract.
- **Validation** (`src/validation.ts`): failing commands resolve with
  `status: "failed"`, captured output, and the exit code; added a timeout and a
  larger output buffer so a hung or chatty command can't wedge the run.
- **Git** (`src/git.ts`): base ref falls back `main` → `master`; rename/copy
  lines (`R100\told\tnew`) are reported as the new path with status `renamed`
  instead of `modified` with both paths glued together; git failures surface
  stderr in a readable error.
- **CLI** (`src/cli.ts`): removed the space-splitting of `--repo`; `--format`
  values other than `markdown` now error honestly instead of being silently
  ignored.
- **Report** (`src/report.ts`): pass/fail markers per validation, empty-state
  lines, and code fences sized longer than any backtick run in the output — so
  command output can't break out of its block (which doubles as prompt-injection
  hygiene when an AI client reads the report).

Test suite went from 1 test to 9 across 4 files, including an end-to-end MCP
call over `InMemoryTransport`.

## What did you intentionally not do?

- **JSON output**: `--format json` was advertised but unimplemented; I made it
  error honestly rather than build a second renderer in the time budget.
- **Non-zero CLI exit when validations fail**: useful for CI, but it requires
  `core.ts` to return structured results instead of a rendered string — an API
  change I didn't want to rush.
- **`untracked` file support**: the status exists in the type but conflicts with
  the commit-range (`base...HEAD`) semantics; left as is rather than half-implement.
- **Allowlisting/gating MCP validation commands**: documented the trust model
  instead (see below).
- **Output truncation for huge reports**: noted as a next step.

## Interface decision

- Decision: **hybrid** — one shared core (`reviewRepository`) with two thin
  adapters, which is the structure the starter already had; my work made the two
  doors behave the same instead of one being broken.
- Primary user and execution environment: a developer on their own machine.
  Humans and CI use the CLI; locally run coding agents (Claude Code, Cursor)
  use the stdio MCP server that the same developer launches.
- Trust boundary and allowed capabilities: the server runs with the invoking
  user's privileges, and stdio MCP grants no *new* privilege — the client that
  launches it could already run commands. The real risk is indirection: an agent
  tricked into passing hostile `validationCommands`, or repository output
  injecting text into the agent's context. Mitigations shipped: the tool
  description tells agents to only pass operator-approved commands and never
  ones derived from repo content, report fences can't be escaped by command
  output, and validations time out.
- Reliability, discoverability, latency/context, and output tradeoffs:
  reliability via timeouts and failures-as-data; discoverability via described
  zod params; latency is dominated by the validation commands themselves;
  context cost is the weak spot — a huge diff or noisy command produces a large
  single text block (truncation is first on the next-steps list).
- How supported interfaces remain consistent: both adapters call the same
  `reviewRepository()`; the report format and the MCP contract are each pinned
  by tests, so a change that breaks one interface fails the suite.
- Evidence that would change this decision: deploying this as a shared/remote
  service would force MCP-first with sandboxed execution and command
  allowlists; telemetry showing agents as the dominant caller would justify
  structured (JSON) tool output before any CLI investment.

## How did you use an AI coding agent?

Claude Code end to end: it read the codebase and proposed the bug triage, wrote
the fixes and tests, and ran the verification loop (typecheck, tests, manual CLI
run). My job was direction and review — setting the scope, reading every diff,
and rejecting work that didn't fit the budget (below).

## Where did you check, correct, or reject an AI suggestion? (required)

- **Rejected the first implementation pass as over-scoped.** The agent's initial
  version rewrote the pipeline: NUL-separated `git diff -z` parsing, a JSON
  renderer, injectable timeouts, and a restructured `core.ts` returning
  structured data. All defensible, but it churned every file and the API for a
  90-minute assessment graded on prioritization. I stopped it mid-write and
  re-scoped to the minimal diff described above — `core.ts` ended up untouched.
- **Rejected replacing `exec` with `execFile` + argument splitting** as a
  "safety" improvement for validation commands. Splitting on whitespace breaks
  quoted arguments (`npm test -- --grep "my case"`), and it buys no real
  boundary: a local stdio server already runs with the user's own privileges.
  Kept shell execution and documented the actual trust model instead.

## Commands used to verify the result, with outcomes

- `npm run typecheck` — clean.
- `npm test` — 9 tests, 4 files, all passing (report format, validation
  pass/fail, git parsing against a real fixture repo, MCP contract over
  `InMemoryTransport`).
- `npm run build && npm test` (the CI order) — this caught a starter wart:
  `tsc` compiles `test/` into `dist/`, and vitest then discovered
  `dist/test/*.test.js` and ran every test twice (18 instead of 9). Fixed by
  scoping the test script to `vitest run --dir test`.
- Manual end-to-end CLI run against a scratch repo **with a space in its path**,
  one passing and one failing validation:
  `npm run inspector -- review --repo ".../fixture repo" --validate "node -e \"console.log('ok')\"" --validate "node -e \"process.exit(2)\""`
  — before the fixes this path was truncated at the space and the failing
  command crashed the run; now the report lists the modified file, ✅ for the
  passing command, and ❌ with `[exit code 2]` for the failing one.

## A blocker you hit and how you approached it

The MCP server connected its stdio transport at module top level, so simply
importing it in a test would hijack stdin/stdout and hang the suite — there was
no way to test the tool contract, which is exactly how the `repo_path`/`repoPath`
mismatch survived. I split construction from startup: `createServer()` is
exported, and the stdio connect only runs when the file is the entrypoint
(`import.meta.url` check). The test then drives a real client and server over
`InMemoryTransport.createLinkedPair()` — the same code path a real client hits.

## Known limitations and the next three things you would do

Limitations: no output-size cap on reports; CLI exits 0 even when validations
fail; `--format json` declared in types but not implemented; validation
commands are unrestricted shell (trusted-operator model); Windows untested.

Next three:

1. Return structured results from `core.ts` so the CLI can exit non-zero on
   failed validations (CI use) and the MCP tool can offer JSON output for agents.
2. Truncate per-command output and total report size with explicit
   `[truncated]` markers, so agent context windows are protected.
3. Add an opt-in allowlist for MCP-invoked validation commands (e.g. a flag at
   server start), tightening the trust model beyond documentation.

## Approximate focused-work time

- Start: 2026-08-14 02:15
- Finish: 2026-08-14 02:45
- Single sitting, AI-assisted throughout; roughly 30 focused minutes.
