# ProfitStack Launch Freeze

## Rule
The dashboard UI is now **frozen for launch**.

From this point until Murphy is live:
- no layout redesigns
- no card reshuffling
- no extra metrics unless required to make the live flow work
- no speculative cleanup passes
- no prototype-vs-live drift

## Allowed changes
Only these are allowed:
1. bug fixes
2. live data-path fixes
3. auth/login fixes
4. onboarding/default fixes required for Murphy
5. copy changes that remove confusion without changing structure

## Locked v1 dashboard
Keep these as the launch surface:
- Scheduled Production
- Approved Sales
- Weekly Goal
- Company SPO
- Next 3 Weeks Scheduled

## Not allowed before Murphy launch
- super-admin
- account-management UI expansions
- extra reporting surfaces
- internal tooling that does not help Murphy use the app
- aesthetic rewrites
- metric experiments

## Decision test
Before making a change, ask:
**Does this directly help Murphy use the live app successfully right now?**

If no, it waits.

## Operating note
When working ProfitStack:
- work only in `profitstack/`
- verify the live-served file when a frontend change matters
- do one change at a time
- commit each working step cleanly
- after every committed change, immediately hand off the exact push/deploy step so the work can actually go live
- if a step does not require Chad's approval, do it automatically instead of telling Chad what needs to be done
- no Nut Report change is considered complete until after deploy + fresh sync + `node scripts/check-nut-report-regression.js` passes
- if the regression check fails, the change is not done and the checkpoint has not been safely preserved
