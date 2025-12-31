-- Migration: Add ownership tracking to bots table
-- Description: Adds created_by and updated_by columns to bots table

-- Add created_by column if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll handle this in the migration logic

-- Add updated_by column if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll handle this in the migration logic

