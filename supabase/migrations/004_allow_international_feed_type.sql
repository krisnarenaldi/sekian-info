-- Migration: 004_allow_international_feed_type.sql
-- Extend check constraint on feed_type to include 'international'

-- Drop existing check constraint (if exists) and recreate with additional allowed value
ALTER TABLE daily_digest
DROP CONSTRAINT IF EXISTS check_feed_type;

ALTER TABLE daily_digest
ADD CONSTRAINT check_feed_type CHECK (feed_type IN ('indonesia', 'sport', 'international','market'));

-- No changes to uniqueness constraint needed (already includes feed_type)
