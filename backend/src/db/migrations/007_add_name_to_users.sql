-- Migration: Add name (display name) to users table
-- Description: Adds name column to users table for display purposes

-- Add name column if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll handle this in the migration logic
