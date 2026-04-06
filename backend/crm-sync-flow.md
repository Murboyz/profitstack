# ProfitStack CRM Sync Flow

## Goal
Turn connected CRM data into normalized weekly metrics.

## Flow
1. organization connects CRM
2. backend stores encrypted connection material
3. scheduled sync starts
4. raw CRM data is pulled
5. raw data is normalized into internal metric shape
6. weekly metrics are stored
7. manual overrides are merged at response time
8. frontend reads merged dashboard payload

## Output priorities
- current week scheduled production
- current week approved sales
- last week scheduled production
- last week approved sales
- next 3 weeks scheduled production

## Rules
- raw source data stays separate from merged output
- bad or untrusted metrics should be suppressed, not faked
- sync history must remain visible for debugging and trust
