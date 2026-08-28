-- =============================================================================
-- WSSO SaaS 01 — Add super_admin to user_role
-- Run this FIRST, by itself, in the Supabase SQL Editor.
-- =============================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
