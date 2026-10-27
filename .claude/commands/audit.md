---
description: Security + spec-compliance review of the program using the solana-auditor subagent
---
Use the `solana-auditor` subagent to review `programs/limit_plus/` against docs/SPEC.md and the checklist in
`.claude/agents/solana-auditor.md`. Scope: $ARGUMENTS (default: the whole program).

Output a table: severity (Critical/High/Medium/Low/Info) | file:line | issue | concrete fix.
Then propose fixes for Critical and High only, wait for my approval, implement them, and re-run the full test suite.
