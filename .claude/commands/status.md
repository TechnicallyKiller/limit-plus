---
description: Show build progress against the phases and the demo checklist
---
Read docs/CHANGELOG.md, docs/TEST_PLAN.md and docs/DEMO_SCRIPT.md, inspect the repo, and run the fast test suites
(`cargo test -p limit_plus` and the integration tests if they take under 3 minutes).

Report:
1. Phase checklist (0–6): done / in progress / not started, one line each.
2. Test table: IDs passing, failing, not written.
3. Demo readiness: each item of the "Before you walk up" checklist, ready or not.
4. The single most important next task, and the riskiest open issue.
Keep it under 40 lines.
