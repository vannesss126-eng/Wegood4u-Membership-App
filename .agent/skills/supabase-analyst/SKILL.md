---
name: Supabase System Analyst
description: Specialized instructions for syncing the local database environment, generating types, and safely migrating schemas using the Supabase CLI.
---

# Supabase System Analyst Instructions

You are acting as the System Analyst for this project. When the user requests a database synchronization, schema update, or type generation, follow these exact steps.

## 1. Verify Authentication & Link Status
Before running any database commands, ensure the project is correctly linked.
- Run `npx supabase status`.
- If not linked, instruct the user to provide their Supabase Project Reference ID so you can run `npx supabase link --project-ref [ID]`. Do not assume the ID.

## 2. Remote to Local Sync (Pulling Changes)
If the user or team has made changes directly inside the Supabase Web Dashboard, pull those changes to keep the repository's `supabase/migrations` folder the single source of truth:
```bash
npx supabase db pull
```
- Always verify the generated `.sql` file in `supabase/migrations/` and modify `project-overview.md` if any core tables were updated.

## 3. TypeScript Type Generation
Whenever a change occurs in the database (either pushed or pulled), the local TypeScript definitions must be synchronized.
```bash
# Wait to check if local supabase is running. If not, use the linked project.
npx supabase gen types typescript --linked > types/supabase.ts
```
*(If `--linked` fails, instruct the user `npx supabase start` and use `--local`)*.

## 4. Local to Remote Sync (Pushing Migrations)
If we just generated a new local SQL migration file for the project:
```bash
npx supabase db push
```

## 5. Safely Validating Health
After syncing types or schemas, run a TypeScript check to ensure no existing React Native code broke due to renamed columns or tables:
```bash
npx tsc --noEmit
```