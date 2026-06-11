-- Migration: 003_add_feed_type_to_daily_digest.sql
-- Add feed_type column to daily_digest table for distinguishing between
-- Indonesia news and Sport news

ALTER TABLE daily_digest
ADD COLUMN feed_type TEXT NOT NULL DEFAULT 'indonesia';

-- Add check constraint for valid feed types
ALTER TABLE daily_digest
ADD CONSTRAINT check_feed_type CHECK (feed_type IN ('indonesia', 'sport'));

-- Update uniqueness constraint to include feed_type
-- (This requires dropping and recreating the constraint)
ALTER TABLE daily_digest
DROP CONSTRAINT daily_digest_date_slug_key;

ALTER TABLE daily_digest
ADD CONSTRAINT daily_digest_date_slug_feed_type_key UNIQUE(date, slug, feed_type);

-- Create composite index for efficient querying by feed_type and date
CREATE INDEX idx_daily_digest_feed_type_date ON daily_digest(feed_type, date DESC);
