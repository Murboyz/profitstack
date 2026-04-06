# ProfitStack Autonomous Rules

## Mission
Move ProfitStack toward launch without wasting tokens or drifting into dumb loops.

## Rules
1. Do exactly one unchecked task from `profitstack/BUILD_QUEUE.md` per run.
2. Keep context small. Read only what is needed.
3. Commit after each meaningful completed chunk.
4. Update `profitstack/BUILD_QUEUE.md` when a task is completed.
5. If blocked, write the blocker into the queue file and stop.
6. Do not ask Chad for routine confirmation during autonomous runs.
7. Do not invent product direction.
8. Do not do broad UI polish unless it directly supports deployment or auth.
9. Prefer deployment, auth, tenant safety, persistence, and real data over mock expansion.
10. If a run starts looping or widening scope, stop.

## Output Standard
At the end of each run:
- one commit maximum unless truly necessary
- one queue update
- no chatter unless explicitly configured later
