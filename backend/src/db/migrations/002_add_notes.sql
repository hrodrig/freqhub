-- Migration: Add notes column to bots table
-- This migration adds a notes field to store user notes about each bot

-- Add notes column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we'll use a different approach in the migration script

ALTER TABLE bots ADD COLUMN notes TEXT;

