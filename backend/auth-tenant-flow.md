# ProfitStack Auth and Tenant Flow

## Goal
Keep ProfitStack tenant-safe for any client account.

## Flow
1. user logs in
2. backend resolves the user record
3. backend resolves the user's organization
4. all API reads and writes are scoped to that organization
5. frontend only receives organization-safe data

## Rules
- every API request must resolve organization scope
- never trust frontend-supplied organization IDs by themselves
- organization scope must be enforced server-side
- row-level security should backstop tenant isolation

## Admin behavior
- admins can manage CRM connections and overrides
- non-admins get read-only dashboard access unless expanded later
