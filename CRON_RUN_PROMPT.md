Read `profitstack/BUILD_QUEUE.md` and `profitstack/AUTONOMOUS_RULES.md`.
Use `profitstack/frontend/app/runtime/profitstack-cron-status.json` as the status file.
Before doing the task, update the status file with:
- `status: "RUNNING"`
- `workingOn: <selected queue task>`
- `updatedAt: <current ISO timestamp>`
- `jobName: "ProfitStack autonomous build pass"`
- preserve up to 10 most recent history items if they already exist

Do exactly one unchecked task.
Keep scope tight.
Commit after completion.
Update the queue file.
If blocked, write the blocker into the queue and stop.
Do not widen scope.

After the task, update the same status file with:
- `status: "COMPLETED" | "BLOCKED" | "NO-OP"`
- `workingOn: <task text>`
- `updatedAt: <current ISO timestamp>`
- `jobName: "ProfitStack autonomous build pass"`
- prepend the latest run to `history` and keep only the 10 most recent entries

Reply with only:
STATUS: COMPLETED | BLOCKED | NO-OP
WORKING ON: <task text>
