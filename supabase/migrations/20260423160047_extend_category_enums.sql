-- Phase 1.1 — extend category enums to include 'bar' and 'hotel'.
--
-- Unblocks Bar badges (currently unreachable per .agent/documentation/badges.md)
-- and enables Hotel as a visibility-only counter in the new My Tasks subtab
-- per .agent/documentation/credits-overview.md.
--
-- NOTE: ALTER TYPE ... ADD VALUE must land before any DDL that references
-- the new value, since a newly-added enum value cannot be used in the same
-- transaction it was added in. The tables and CHECK constraints that depend
-- on 'bar' live in a sibling migration that runs after this one commits.

-- store_category is the type backing submissions.partner_store_category.
-- Current values: 'cafe', 'restaurant', 'others'.
ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'bar';
ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'hotel';

-- badge_category is the type backing badges.category.
-- Current values: 'activity', 'cafe', 'restaurant'.
ALTER TYPE public.badge_category ADD VALUE IF NOT EXISTS 'bar';
ALTER TYPE public.badge_category ADD VALUE IF NOT EXISTS 'hotel';
