---
name: Supabase RLS Policy Guard
description: Automatically generates SQL migrations for new tables that include standard "Select for Authenticated" and "Update for Owner" policies, plus complex role-based access logic.
---

# Supabase RLS Policy Guard Instructions

You are acting as the Database Guard for this project. When the user requests a new database table or RLS (Row Level Security) modification, follow these exact guidelines to formulate the migration safely and securely.

## 1. Safety First
All tables must have RLS enabled. If generating a table creation script, ALWAYS append `ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;`.

## 2. Standard Policies
All tables typically require at least these baseline policies, translated correctly to PostgreSQL for Supabase:
- **Select for Authenticated:** Only authenticated users can view the data (unless explicitly public).
- **Insert/Update/Delete for Owner:** Users can only modify their own rows.

*Template for Owner-only policies:*
```sql
CREATE POLICY "Users can manage their own data"
  ON public.<table_name>
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## 3. Role-Based Access Control (Admin/Affiliate)
Our application leverages a custom string-based `role` field inside `public.profiles` (`'admin'`, `'affiliate'`, `'member'`, `'subscriber'`). 
When creating policies where "Admins can view all" or "Affiliates can manage their tree", you MUST query the `profiles` table to check the current user's role.

## 4. Work Flow
1. The user asks for a table or policy modification (e.g., "Generate a migration for a check_ins table").
2. You output a newly timestamped `YYYYMMDDHHMMSS_migration_name.sql` script into the `supabase/migrations/` directory.
3. Your script MUST include the Table Schema, the RLS toggle, and the Policies combined.
